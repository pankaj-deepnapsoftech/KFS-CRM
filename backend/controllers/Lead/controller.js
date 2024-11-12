const { TryCatch, ErrorHandler } = require("../../helpers/error");
const peopleModel = require("../../models/people");
const companyModel = require("../../models/company");
const leadModel = require("../../models/lead");
const customerModel = require("../../models/customer");
const notificationModel = require("../../models/notification");
const mongoose = require("mongoose");
const indiamartLeadModel = require("../../models/indiamart_lead");
const adminModel = require("../../models/admin");
const { emitEvent } = require("../../helpers/socket");

const createLead = TryCatch(async (req, res) => {
  const {
    leadtype,
    status,
    source,
    peopleId,
    companyId,
    notes,
    products,
    assigned,
    followup_date,
    followup_reason,
  } = req.body;

  if (leadtype === "People" && peopleId) {
    const isExistingPeople = await peopleModel.findById(peopleId);

    if (!isExistingPeople) {
      throw new Error("Person doesn't exists", 400);
    }

    const lead = await leadModel.create({
      creator: assigned || req.user.id,
      leadtype,
      status,
      source,
      people: peopleId,
      notes,
      products,
      assigned,
      followup_date,
      followup_reason,
    });

    // Lead completed, now make the person customer
    if (status === "Completed") {
      const isExistingCustomer = await customerModel.findOne({
        people: peopleId,
      });
      if (!isExistingCustomer) {
        const customer = await customerModel.create({
          creator: lead.creator,
          customertype: leadtype,
          people: peopleId,
          products,
        });
      }
    } else if (
      status === "Follow Up" &&
      new Date(lead?.followup_date).toLocaleDateString() ===
        new Date().toLocaleDateString()
    ) {
      const date = new Date();
      const followupDate = new Date(lead?.followup_date);
      if (
        date.getFullYear() === followupDate.getFullYear() &&
        date.getMonth() === followupDate.getMonth() &&
        date.getDate() === followupDate.getDate()
      ) {
        const creator = await adminModel.findById(lead.creator);
        const receivers = [{ email: creator.email }];
        await notificationModel.create({
          author: creator._id,
          message: `You have a new lead of ${
            isExistingPeople.firstname +
            (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
          } for follow up`,
        });

        emitEvent(
          req,
          "NEW_FOLLOWUP_LEAD",
          receivers,
          `You have a new lead of ${
            isExistingPeople.firstname +
            (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
          } for follow up`
        );
      }
    } else if (status === "Assigned") {
      const assignedTo = await adminModel.findById(lead?.assigned);
      const receivers = [{ email: assignedTo.email }];
      await notificationModel.create({
        author: assignedTo._id,
        message: `${
          isExistingPeople.firstname +
          (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
        }'s lead has been assigned to you`,
      });

      emitEvent(
        req,
        "NEW_ASSIGNED_LEAD",
        receivers,
        `${
          isExistingPeople.firstname +
          (isExistingPeople?.lastname ? " " + isExistingPeople?.lastname : "")
        }'s lead has been assigned to you`
      );
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Lead has been created successfully",
      lead: lead,
    });
  } else if (leadtype === "Company" && companyId) {
    const isExistingCompany = await companyModel.findById(companyId);

    if (!isExistingCompany) {
      throw new Error("Corporate doesn't exists", 400);
    }

    const lead = await leadModel.create({
      creator: req.user.id,
      leadtype,
      status,
      source,
      company: companyId,
      notes,
      followup_date,
      followup_reason,
    });

    // Lead completed, now make the company customer
    if (status === "Completed") {
      const isExistingCustomer = await customerModel.findOne({
        company: companyId,
      });

      if (!isExistingCustomer) {
        const customer = await customerModel.create({
          creator: lead.creator,
          customertype: leadtype,
          company: companyId,
          products,
        });
      }
    } else if (status === "Follow Up") {
      const date = new Date();
      const followupDate = new Date(lead?.followup_date);
      if (
        date.getFullYear() === followupDate.getFullYear() &&
        date.getMonth() === followupDate.getMonth() &&
        date.getDate() === followupDate.getDate()
      ) {
        const creator = await adminModel.findById(lead.creator);
        const receivers = [{ email: creator.email }];
        await notificationModel.create({
          author: creator._id,
          message: `You have a new lead of ${isExistingCompany.companyname} for follow up`,
        });

        emitEvent(
          req,
          "NEW_FOLLOWUP_LEAD",
          receivers,
          `You have a new lead of ${isExistingCompany.companyname} for follow up`
        );
      }
    } else if (status === "Assigned") {
      const assignedTo = await adminModel.findById(lead?.assigned);
      const receivers = [{ email: assignedTo.email }];
      await notificationModel.create({
        author: assignedTo._id,
        message: `${isExistingCompany.companyname}'s lead has been assigned to you`,
      });

      emitEvent(
        req,
        "NEW_ASSIGNED_LEAD",
        receivers,
        `${isExistingCompany.companyname}'s lead has been assigned to you`
      );
    }

    return res.status(200).json({
      status: 200,
      success: true,
      message: "Lead has been created successfully",
      lead: lead,
    });
  }

  throw new ErrorHandler("Lead type must be Individual or Corporate");
});

const editLead = async (req, res) => {
  const {
    leadId,
    status,
    source,
    notes,
    products,
    assigned,
    followup_date,
    followup_reason,
  } = req.body;

  const isExistingLead = await leadModel.findById(leadId);
  if (!isExistingLead) {
    throw new ErrorHandler("Lead doesn't exists", 400);
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingLead.creator.toString() !== req.user.id.toString() &&
    isExistingLead?.assigned?._id?.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to edit this lead", 401);
  }

  if (
    (isExistingLead.status === "Follow Up" && status !== "Follow Up") ||
    (isExistingLead?.followup_date &&
      followup_date &&
      isExistingLead.followup_date !== followup_date)
  ) {
    await notificationModel.deleteOne({ lead: isExistingLead._id });
  }

  let updatedLead;

  if (status === "Assigned") {
    updatedLead = await leadModel
      .findOneAndUpdate(
        { _id: leadId },
        {
          $unset: { followup_date: "", followup_reason: "" },
          $set: { creator: assigned, status: status, assigned, notes, source },
        },
        { new: true }
      )
      .populate("company")
      .populate("people");

    const name = updatedLead?.people
      ? updatedLead?.people?.firstname +
        (updatedLead?.people?.lastname
          ? " " + updatedLead?.people?.lastname
          : "")
      : updatedLead?.company?.companyname;

    const assignedTo = await adminModel.findById(updatedLead?.assigned);
    const receivers = [{ email: assignedTo.email }];

    await notificationModel.create({
      author: assignedTo._id,
      message: `${name}'s lead has been assigned to you`,
    });

    emitEvent(
      req,
      "NEW_FOLLOWUP_LEAD",
      receivers,
      `${name}'s lead has been assigned to you`
    );
  } else if (status === "Follow Up") {
    updatedLead = await leadModel
      .findOneAndUpdate(
        { _id: leadId },
        {
          $unset: { assigned: "" },
          $set: {
            status: status,
            followup_date,
            followup_reason,
            notes,
            source,
          },
        },
        { new: true }
      )
      .populate("company")
      .populate("people");

    if (
      new Date(updatedLead?.followup_date).toLocaleDateString() ===
      new Date().toLocaleDateString()
    ) {
      const name = updatedLead?.people
        ? updatedLead?.people?.firstname +
          (updatedLead?.people?.lastname
            ? " " + updatedLead?.people?.lastname
            : "")
        : updatedLead?.company?.companyname;

      const creator = await adminModel.findById(updatedLead?.creator);
      const receivers = [{ email: creator.email }];

      await notificationModel.create({
        author: creator._id,
        message: `You have a new lead of ${name} for follow up`,
      });

      emitEvent(
        req,
        "NEW_FOLLOWUP_LEAD",
        receivers,
        `You have a new lead of ${name} for follow up`
      );
    }
  } else {
    updatedLead = await leadModel.findOneAndUpdate(
      { _id: leadId },
      {
        $unset: { assigned: "", followup_date: "", followup_reason: "" },
        $set: { status: status, source, notes },
      },
      { new: true }
    );
  }

  if (status === "Completed") {
    let isExistingCustomer;
    if (isExistingLead?.people) {
      isExistingCustomer = await customerModel.findOne({
        people: isExistingLead.people,
      });
    }
    if (isExistingLead?.company) {
      isExistingCustomer = await customerModel.findOne({
        company: isExistingLead.company,
      });
    }

    if (!isExistingCustomer) {
      if (isExistingLead?.people) {
        await customerModel.create({
          creator: isExistingLead.creator,
          customertype: isExistingLead.leadtype,
          people: isExistingLead.people,
          products,
        });
      } else {
        await customerModel.create({
          creator: isExistingLead.creator,
          customertype: isExistingLead.leadtype,
          company: isExistingLead.company,
          products,
        });
      }
    }
  }

  return res.status(200).json({
    status: 200,
    success: true,
    message: "Lead has been updated successfully",
    updatedLead: updatedLead,
  });
};

const deleteLead = TryCatch(async (req, res) => {
  const { leadId } = req.body;

  const isExistingLead = await leadModel.findById(leadId);

  if (!isExistingLead) {
    throw new ErrorHandler("Lead doesn't exists");
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingLead.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to delete this lead", 401);
  }

  const deletedLead = await leadModel.deleteOne({ _id: leadId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Lead has been deleted successfully",
    deletedLead: deletedLead,
  });
});

const leadDetails = TryCatch(async (req, res) => {
  const { leadId } = req.body;

  const lead = await leadModel
    .findById(leadId)
    .populate("people", "firstname lastname email phone")
    .populate("company", "companyname email phone")
    .populate("assigned", "name phone email")
    .populate({
      path: "products",
      populate: [
        {
          path: "category",
          model: "Product Category",
          select: "categoryname",
        },
      ],
    });

  if (!lead) {
    throw new ErrorHandler("Lead doesn't exists", 400);
  }

  if (
    req.user.role !== "Super Admin" &&
    lead.creator.toString() !== req.user.id.toString() &&
    lead?.assigned?._id?.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to access this lead", 401);
  }

  res.status(200).json({
    status: 200,
    success: true,
    lead: lead,
  });
});

const allLeads = TryCatch(async (req, res) => {
  const { page = 1 } = req.body;
  // const totalLeadsPerPage = 10;
  // const skip = (page-1)*totalLeadsPerPage;

  let leads = [];

  if (req.user.role === "Super Admin") {
    leads = await leadModel
      .find()
      .sort({ createdAt: -1 })
      .populate("people", "-_id firstname lastname email phone")
      .populate("company", "-_id companyname email phone")
      .populate("assigned", "name")
      .populate("creator", "name");
  } else {
    leads = await leadModel
      .find({ creator: req.user.id })
      .sort({ createdAt: -1 })
      .populate("people", "-_id firstname lastname email phone")
      .populate("company", "-_id companyname email phone")
      .populate("assigned", "name")
      .populate("creator", "name");
  }

  const results = leads.map((lead) => {
    return {
      _id: lead._id,
      name:
        lead.people !== undefined
          ? lead.people?.firstname + " " + (lead.people?.lastname || "")
          : lead.company.companyname,
      status: lead.status,
      email: lead.people !== undefined ? lead.people.email : lead.company.email,
      phone: lead.people !== undefined ? lead.people.phone : lead.company.phone,
      source: lead.source,
      leadtype: lead.leadtype,
      assigned: lead?.assigned?.name,
      followup_date: lead?.followup_date,
      followup_reason: lead?.followup_reason,
      creator: lead?.creator.name,
      createdAt: lead?.createdAt,
    };
  });

  res.status(200).json({
    status: 200,
    success: true,
    leads: results,
  });
});

const assignedLeads = TryCatch(async (req, res) => {
  const user = req.user.id;

  let leads;
  let indiamartLeads;
  if (req.user.role === "Super Admin") {
    leads = await leadModel
      .find({
        status: "Assigned",
        // $or: [{ creator: user }, { assigned: user }],
      })
      .sort({ createdAt: -1 })
      .populate("people", "-_id firstname lastname email phone")
      .populate("company", "-_id companyname email phone")
      .populate("assigned", "name")
      .populate("creator", "name");

    indiamartLeads = await indiamartLeadModel
      .find({ status: "Assigned" })
      .sort({ createdAt: -1 })
      .populate("assigned", "name");
  } else {
    leads = await leadModel
      .find({
        status: "Assigned",
        $or: [{ creator: user }, { assigned: user }],
      })
      .sort({ createdAt: -1 })
      .populate("people", "-_id firstname lastname email phone")
      .populate("company", "-_id companyname email phone")
      .populate("assigned", "name")
      .populate("creator", "name");

    indiamartLeads = await indiamartLeadModel
      .find({ status: "Assigned", assigned: user })
      .sort({ createdAt: -1 })
      .populate("assigned", "name");
  }

  const results = leads.map((lead) => {
    return {
      _id: lead._id,
      name:
        lead.people !== undefined
          ? lead.people?.firstname + " " + (lead.people?.lastname || "")
          : lead.company.companyname,
      status: lead.status,
      email: lead.people !== undefined ? lead.people.email : lead.company.email,
      phone: lead.people !== undefined ? lead.people.phone : lead.company.phone,
      source: lead.source,
      leadtype: lead.leadtype,
      assigned: lead?.assigned?.name,
      followup_date: lead?.followup_date,
      followup_reason: lead?.followup_reason,
      creator: lead?.creator?.name,
      createdAt: lead?.createdAt,
    };
  });

  results.push(
    ...indiamartLeads.map((lead) => {
      return {
        _id: lead._id,
        name: lead?.SENDER_NAME,
        status: lead?.status,
        email: lead?.SENDER_EMAIL || lead?.SENDER_EMAIL_ALT,
        phone: lead?.SENDER_MOBILE || lead?.SENDER_MOBILE_ALT,
        source: "Indiamart",
        leadtype: "Indiamart",
        assigned: lead?.assigned?.name,
        followup_date: lead?.followup_date,
        followup_reason: lead?.followup_reason,
        creator: "Indiamart",
        createdAt: lead?.QUERY_TIME,
      };
    })
  );

  res.status(200).json({
    status: 200,
    success: true,
    leads: results,
  });
});

const leadSummary = TryCatch(async (req, res) => {
  const user = new mongoose.Types.ObjectId(req.user.id);
  let leads;

  if (req.user.role === "Super Admin") {
    leads = await leadModel.aggregate([
      {
        $facet: {
          totalCount: [
            {
              $group: {
                _id: null,
                count: {
                  $sum: 1,
                },
              },
            },
          ],
          statusCount: [
            {
              $group: {
                _id: "$status",
                count: {
                  $sum: 1,
                },
              },
            },
            {
              $project: {
                _id: 0,
                k: "$_id",
                v: "$count",
              },
            },
          ],
        },
      },
      {
        $project: {
          totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
          statusCount: {
            $arrayToObject: "$statusCount",
          },
        },
      },
    ]);
  } else {
    leads = await leadModel.aggregate([
      { $match: { creator: user } },
      {
        $facet: {
          totalCount: [{ $group: { _id: null, count: { $sum: 1 } } }],
          statusCount: [
            { $group: { _id: "$status", count: { $sum: 1 } } },
            { $project: { _id: 0, k: "$_id", v: "$count" } },
          ],
        },
      },
      {
        $project: {
          totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
          statusCount: { $arrayToObject: "$statusCount" },
        },
      },
    ]);
  }

  res.status(200).json({
    status: 200,
    success: true,
    leads,
  });
});

module.exports = {
  createLead,
  editLead,
  deleteLead,
  allLeads,
  leadDetails,
  assignedLeads,
  leadSummary,
};
