const { TryCatch } = require("../../helpers/error");
const { emitEvent } = require("../../helpers/socket");
const adminModel = require("../../models/admin");
const notificationModel = require("../../models/notification");
const supportModel = require("../../models/support");

const createSupport = TryCatch(async (req, res) => {
  let { name, mobile, purpose, description } = req.body;
  purpose = purpose.toLowerCase();

  const support = await supportModel.create({
    name,
    purpose,
    mobile,
    description,
  });

  const admins = await adminModel.find({ role: "Super Admin" });
  const receivers = admins.map((admin) => ({ email: admin.email }));

  await notificationModel.create({
    author: admins[0]._id,
    message: `You got a new query from ${name}`,
  });

  emitEvent(
    req,
    "NEW_SUPPORT_QUERY",
    receivers,
    `You got a new query from ${name}`
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Your request has been submitted successfully",
  });
});

const deleteSupport = TryCatch(async (req, res) => {
  const { supportId } = req.body;

  const isExistingSupport = await supportModel.findById(supportId);
  if (!isExistingSupport) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Support doesn't exist",
    });
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingSupport?.assigned &&
    isExistingSupport?.assigned?.toString() !== req.user.id.toString()
  ) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: "You are not authorized to access this route",
    });
  }

  await supportModel.deleteOne({ _id: supportId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Support has been deleted successfully",
  });
});

const editSupport = TryCatch(async (req, res) => {
  let { supportId, assigned, status, remarks } = req.body;

  const isExistingSupport = await supportModel.findById(supportId);
  if (!isExistingSupport) {
    return res.status(404).json({
      status: 404,
      success: false,
      message: "Support doesn't exist",
    });
  }
  if (status.toLowerCase() === "assigned" && !assigned) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Please provide the assigned field",
    });
  }

  status = status.toLowerCase();

  if (
    req.user.role !== "Super Admin" &&
    isExistingSupport?.assigned &&
    isExistingSupport?.assigned?.toString() !== req.user.id.toString()
  ) {
    return res.status(401).json({
      status: 401,
      success: false,
      message: "You are not authorized to access this route",
    });
  }

  await supportModel.updateOne(
    { _id: supportId },
    { remarks, assigned, status }
  );

  if (assigned) {
    const support = await supportModel.findById(supportId);
    const user = await adminModel.findById(assigned);
    const receivers = [{ email: user.email }];

    await notificationModel.create({
      author: user._id,
      message: `${support.name}'s query assigned to you`,
    });

    emitEvent(
      req,
      "SUPPORT_QUERY_ASSIGNED",
      receivers,
      `${support.name}'s query assigned to you`
    );
  }

  res.status(200).json({
    status: 200,
    success: true,
    message: "Support has been updated successfully",
  });
});

const getSupportDetails = TryCatch(async (req, res) => {
  const { supportId } = req.body;

  const support = await supportModel
    .findOne({ _id: supportId })
    .populate("assigned", "name email phone");

  if (!support) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: "Support doesn't exist",
    });
  }

  res.status(200).json({
    status: 200,
    success: true,
    support,
  });
});

const getAllSupport = TryCatch(async (req, res) => {
  const support = await supportModel
    .find({})
    .sort({ updatedAt: -1 })
    .populate("assigned", "name email phone");

  res.status(200).json({
    status: 200,
    success: true,
    support,
  });
});

const getAllAssignedSupport = TryCatch(async (req, res) => {
  let support;
  if (req.user.role === "Super Admin") {
    support = await supportModel
      .find({ status: "assigned" })
      .sort({ updatedAt: -1 })
      .populate("assigned", "name email phone");
  } else {
    support = await supportModel
      .find({
        status: "assigned",
        $or: [{ creator: req.user.id }, { assigned: req.user.id }],
      })
      .populate("assigned", "name email phone");
  }

  res.status(200).json({
    status: 200,
    success: true,
    support,
  });
});

const supportSummary = TryCatch(async (req, res) => {
  const supports = await supportModel.aggregate([
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
        purposeCount: [
          {
            $group: {
              _id: "$purpose",
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
        statusCount: [
          {
            $group: {
              _id: { purpose: "$purpose", status: "$status" },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: "$_id.purpose",
              statuses: {
                $push: {
                  k: "$_id.status",
                  v: "$count",
                },
              },
            },
          },
          {
            $project: {
              statuses: { $arrayToObject: "$statuses" },
            },
          },
          {
            $project: {
              _id: 0,
              k: "$_id",
              v: "$statuses",
            },
          },
        ],
      },
    },
    {
      $project: {
        totalCount: { $arrayElemAt: ["$totalCount.count", 0] },
        purposeCount: { $arrayToObject: "$purposeCount" },
        statusCount: { $arrayToObject: "$statusCount" },
      },
    },
  ]);

  res.status(200).json({
    status: 200,
    success: true,
    supports,
  });
});

module.exports = {
  createSupport,
  deleteSupport,
  editSupport,
  getSupportDetails,
  getAllSupport,
  getAllAssignedSupport,
  supportSummary,
};
