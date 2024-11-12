const { TryCatch } = require("../../helpers/error");
const axios = require("axios");
const indiamartLeadModel = require("../../models/indiamart_lead");
const notificationModel = require("../../models/notification");
const moment = require("moment");
const customerModel = require("../../models/customer");
const companyModel = require("../../models/company");
const peopleModel = require("../../models/people");
const adminModel = require("../../models/admin");

const fetchData = async (url) => {
  try {
    const response = await axios.get(url);
    if (response?.data?.STATUS === "SUCCESS") {
      return response?.data?.RESPONSE;
    }

    return [];
  } catch (err) {
    console.log(err.message);
    return [];
  }
};

const fetchLast7Days = async () => {
  const end = moment().format("DD-MMM-YYYY");
  const start = moment().subtract(7, "days").format("DD-MMM-YYYY");

  try {
    const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${process.env.INDIAMART_API_KEY}&start_time=${start}&end_time=${end}`;

    const leads = await fetchData(url);

    if (leads.length > 0) {
      const admin = await adminModel.findOne({ role: "Super Admin" });

      for (const lead of leads) {
        // If the lead has company name associated with it
        let companyId;
        let peopleId;
        if (lead?.SENDER_COMPANY && lead?.SENDER_COMPANY !== "") {
          const isCompanyExist = await companyModel.findOne({
            $or: [
              { email: lead?.SENDER_EMAIL },
              { phone: lead?.SENDER_MOBILE },
            ],
          });

          if (!isCompanyExist) {
            const phone = lead?.SENDER_MOBILE?.split("-")[1];
            const email = lead?.SENDER_EMAIL;
            const name = lead?.SENDER_COMPANY;
            const contact = lead?.SENDER_NAME;

            const newCompany = await companyModel.create({
              companyname: name,
              contact: contact,
              email: email,
              phone: phone,
              creator: admin._id,
            });
            companyId = newCompany._id;
          } else {
            companyId = isCompanyExist._id;
          }
        }
        // Else
        else {
          const isPeopleExist = await peopleModel.findOne({
            $or: [
              { email: lead?.SENDER_EMAIL },
              { phone: lead?.SENDER_MOBILE },
            ],
          });

          if (!isPeopleExist) {
            const phone = lead?.SENDER_MOBILE?.split("-")[1];
            const email = lead?.SENDER_EMAIL;
            const name = lead?.SENDER_NAME?.split(" ");

            const newPeople = await peopleModel.create({
              firstname: name[0],
              lastname: name.length > 1 ? name[1] : undefined,
              email: email,
              phone: phone,
              creator: admin._id,
            });
            peopleId = newPeople._id;
          } else {
            peopleId = isPeopleExist._id;
          }
        }

        await indiamartLeadModel.create({
          ...lead,
          creator: admin._id,
          company: companyId,
          people: peopleId,
        });
      }
    }
  } catch (err) {
    console.log(err.message);
  }
};

const fetchLast5Mins = async () => {
  try {
    const url = `https://mapi.indiamart.com/wservce/crm/crmListing/v2/?glusr_crm_key=${process.env.INDIAMART_API_KEY}`;

    const leads = await fetchData(url);

    if (leads.length > 0) {
        const admin = await adminModel.findOne({ role: "Super Admin" });
  
        for (const lead of leads) {
          // If the lead has company name associated with it
          let companyId;
          let peopleId;
          if (lead?.SENDER_COMPANY && lead?.SENDER_COMPANY !== "") {
            const isCompanyExist = await companyModel.findOne({
              $or: [
                { email: lead?.SENDER_EMAIL },
                { phone: lead?.SENDER_MOBILE },
              ],
            });
  
            if (!isCompanyExist) {
              const phone = lead?.SENDER_MOBILE?.split("-")[1];
              const email = lead?.SENDER_EMAIL;
              const name = lead?.SENDER_COMPANY;
              const contact = lead?.SENDER_NAME;
  
              const newCompany = await companyModel.create({
                companyname: name,
                contact: contact,
                email: email,
                phone: phone,
                creator: admin._id,
              });
              companyId = newCompany._id;
            } else {
              companyId = isCompanyExist._id;
            }
          }
          // Else
          else {
            const isPeopleExist = await peopleModel.findOne({
              $or: [
                { email: lead?.SENDER_EMAIL },
                { phone: lead?.SENDER_MOBILE },
              ],
            });
  
            if (!isPeopleExist) {
              const phone = lead?.SENDER_MOBILE?.split("-")[1];
              const email = lead?.SENDER_EMAIL;
              const name = lead?.SENDER_NAME?.split(" ");
  
              const newPeople = await peopleModel.create({
                firstname: name[0],
                lastname: name.length > 1 ? name[1] : undefined,
                email: email,
                phone: phone,
                creator: admin._id,
              });
              peopleId = newPeople._id;
            } else {
              peopleId = isPeopleExist._id;
            }
          }
  
          await indiamartLeadModel.create({
            ...lead,
            creator: admin._id,
            company: companyId,
            people: peopleId,
          });
        }
      }
  } catch (err) {
    console.log(err.message);
  }
};

const allLeads = TryCatch(async (req, res) => {
  // const leads = await indiamartLeadModel
  //   .find()
  //   .sort({ updatedAt: "desc" })
  //   .populate("assigned", "name phone email");

  // res.status(200).json({
  //   status: 200,
  //   success: true,
  //   leads,
  // });
  let leads;
  if(req.user.role === 'Super Admin'){
    leads = await indiamartLeadModel
    .find()
    .sort({ updatedAt: "desc" })
    .populate("assigned", "name phone email")
    .populate("creator", "name");
  }
  else{
    leads = await indiamartLeadModel
    .find({creator: req.user.id})
    .sort({ updatedAt: "desc" })
    .populate("assigned", "name phone email")
    .populate("creator", "name");
  }

  res.status(200).json({
    status: 200,
    success: true,
    leads,
  });
});

const leadDetails = TryCatch(async (req, res) => {
  const { _id } = req.body;

  const lead = await indiamartLeadModel
    .findById(_id)
    .populate("assigned", "name phone email");
  if (!lead) {
    throw new Error("Lead doesn't exist", 404);
  }

  res.status(200).json({
    status: 200,
    success: true,
    lead,
  });
});

const deleteLead = TryCatch(async (req, res) => {
  const { leadId } = req.body;

  const isExistingLead = await indiamartLeadModel.findById(leadId);

  if (!isExistingLead) {
    throw new ErrorHandler("Lead doesn't exists");
  }

  // if (
  //   req.user.role !== "Super Admin" &&
  //   isExistingLead.creator.toString() !== req.user.id.toString()
  // ) {
  //   throw new Error("You are not allowed to delete this lead", 401);
  // }

  const deletedLead = await indiamartLeadModel.deleteOne({ _id: leadId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Lead has been deleted successfully",
    deletedLead: deletedLead,
  });
});

const editLead = TryCatch(async (req, res) => {
  const { leadId, status, remarks, assigned, followup_date, followup_reason } =
    req.body;

  const isExistingLead = await indiamartLeadModel.findById(leadId);
  if (!isExistingLead) {
    throw new ErrorHandler("Lead doesn't exists", 400);
  }

  // if (
  //     req.user.role !== "Super Admin" &&
  //     isExistingLead.creator.toString() !== req.user.id.toString() &&
  //     isExistingLead?.assigned?._id?.toString() !== req.user.id.toString()
  // ) {
  //     throw new Error("You are not allowed to edit this lead", 401);
  // }

  if (
    (isExistingLead.status === "Follow Up" && status !== "Follow Up") ||
    (isExistingLead?.followup_date &&
      followup_date &&
      isExistingLead.followup_date !== followup_date)
  ) {
    // await indiamartLeadModel.findOneAndUpdate(
    //     { _id: leadId },
    //     { $unset: { followup_date: "", followup_reason: "" } },
    //     { new: true }
    // );
    await notificationModel.deleteOne({ lead: isExistingLead._id });
  }

  let updatedLead;

  if (status === "Assigned") {
    updatedLead = await indiamartLeadModel.findOneAndUpdate(
      { _id: leadId },
      {
        $unset: { followup_date: "", followup_reason: "" },
        $set: { creator: assigned, status: status, remarks, assigned },
      },
      { new: true }
    );
  } else if (status === "Follow Up") {
    updatedLead = await indiamartLeadModel.findOneAndUpdate(
      { _id: leadId },
      {
        $unset: { assigned: "" },
        $set: { status: status, remarks, followup_date, followup_reason },
      },
      { new: true }
    );
  } else {
    updatedLead = await indiamartLeadModel.findOneAndUpdate(
      { _id: leadId },
      {
        $unset: { assigned: "", followup_date: "", followup_reason: "" },
        $set: { status: status, remarks },
      },
      { new: true }
    );
  }

  if (status === "Completed") {
    const isPeople = isExistingLead?.SENDER_COMPANY === "" ? true : false;

    // Find if the lead belongs to people or company and if they doesn't exist then create them
    // if (isPeople) {
    //   const isExistingPeople = await peopleModel.findOne({
    //     $or: [
    //       { phone: isExistingLead?.SENDER_MOBILE },
    //       { email: isExistingLead?.SENDER_EMAIL },
    //     ],
    //   });
    //   if (!isExistingPeople) {
    //     const name = isExistingLead?.SENDER_NAME.split(" ");
    //     const firstname = name[0];
    //     const lastname = name.length > 1 ? name[1] : "";
    //     await peopleModel.create({
    //       creator: req.user.id,
    //       firstname,
    //       lastname,
    //       email: isExistingLead?.SENDER_EMAIL,
    //       phone: isExistingLead?.SENDER_MOBILE,
    //     });
    //   }
    // } else {
    //   const isExistingCompany = await companyModel.findOne({
    //     $or: [
    //       { phone: isExistingLead?.SENDER_PHONE },
    //       { email: isExistingLead?.SENDER_EMAIL },
    //     ],
    //   });
    //   if (!isExistingCompany) {
    //     await companyModel.create({
    //       creator: req.user.id,
    //       companyname: isExistingLead?.SENDER_COMPANY,
    //       email: isExistingLead?.SENDER_EMAIL,
    //       phone: isExistingLead?.SENDER_MOBILE,
    //       contact: isExistingLead?.SENDER_NAME,
    //     });
    //   }
    // }

    // Check if there is already a customer corresponding to the people or company
    if (isExistingLead?.people) {
      const isExistingCustomer = await customerModel.findOne({
        people: isExistingLead?.people._id,
      });
      if (!isExistingCustomer) {
        await customerModel.create({
          creator: req.user.id,
          people: isExistingLead?.people._id,
          customertype: "People",
          // products: []
        });
      }
    } else {
      const isExistingCustomer = await customerModel.findOne({
        company: isExistingLead?.company._id,
      });
      if (!isExistingCustomer) {
        await customerModel.create({
          creator: req.user.id,
          company: isExistingLead?.company._id,
          customertype: "Company",
          // products: []
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
});

module.exports = {
  fetchLast7Days,
  allLeads,
  leadDetails,
  editLead,
  deleteLead,
  fetchLast5Mins,
};
