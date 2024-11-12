const { TryCatch, ErrorHandler } = require("../../helpers/error");
const { fetchImage } = require("../../helpers/fetchImage");
const customerModel = require("../../models/customer");
const invoiceModel = require("../../models/invoice");
const productModel = require("../../models/product");
const PDFTable = require("pdfkit-table");

const createInvoice = TryCatch(async (req, res) => {
  const {
    customer,
    customeraddress,
    status,
    startdate,
    expiredate,
    remarks,
    products,
    subtotal,
    total,
    tax,
  } = req.body;

  const currYear = new Date().getFullYear();
  const totalInvoices = await invoiceModel.find().countDocuments();
  const invoicename = `${totalInvoices + 1}/${currYear}`;

  const isExistingCustomer = await customerModel.findById(customer);
  if (!isExistingCustomer) {
    throw new Error("Customer doesn't exists", 404);
  }

  const errorArr = [];
  const productsPromise = products.map(async (product) => {
    const availableProduct = await productModel.findById(product.product);
    if (availableProduct.stock >= product.quantity) {
      const updatedStock = await productModel.findByIdAndUpdate(
        product.product,
        { stock: availableProduct.stock - product.quantity }
      );
      productsPromise.push(updatedStock);
    } else {
      errorArr.push(
        `Only ${availableProduct.stock} units are available of ${availableProduct.name}`
      );
    }
  });
  await Promise.all(productsPromise);

  if (errorArr.length > 0) {
    return res.status(400).json({
      status: 400,
      success: false,
      message: errorArr.join(","),
    });
  }

  const invoice = await invoiceModel.create({
    creator: req.user.id,
    invoicename,
    customer,
    customeraddress,
    status,
    startdate,
    expiredate,
    remarks,
    products,
    subtotal,
    total,
    tax,
    paid: 0,
    createdBy: req.user.id,
    balance: total,
  });

  await customerModel.findOneAndUpdate(
    { _id: customer },
    { status: "Invoice Sent" }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Invoice has been created successfully",
  });
});

const editInvoice = TryCatch(async (req, res) => {
  const {
    invoiceId,
    customer,
    customeraddress,
    status,
    startdate,
    expiredate,
    remarks,
    products,
    subtotal,
    total,
    tax,
  } = req.body;

  const currYear = new Date().getFullYear();
  const totalInvoices = await invoiceModel.find().countDocuments();
  const invoicename = `${totalInvoices + 1}/${currYear}`;

  const isExistingCustomer = await customerModel.findById(customer);
  if (!isExistingCustomer) {
    throw new Error("Customer doesn't exists", 404);
  }

  const isExistingInvoice = await invoiceModel.findById(invoiceId);
  if (!isExistingInvoice) {
    throw new Error("Invoice doesn't exists", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingInvoice.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to edit this invoice", 401);
  }

  const invoice = await invoiceModel.findOneAndUpdate(
    { _id: invoiceId },
    {
      invoicename,
      customer,
      customeraddress,
      status,
      startdate,
      expiredate,
      remarks,
      products,
      subtotal,
      total,
      tax,
    }
  );

  res.status(200).json({
    status: 200,
    success: true,
    message: "Invoice has been updated successfully",
  });
});

const getAllInvoices = TryCatch(async (req, res) => {
  let invoices = [];

  if (req.user.role === "Super Admin") {
    invoices = await invoiceModel
      .find()
      .populate({
        path: "customer",
        populate: [
          {
            path: "company",
            model: "Company",
            select: "companyname",
          },
          {
            path: "people",
            model: "People",
            select: "firstname lastname",
          },
        ],
      })
      .populate("creator", "name");
  } else {
    invoices = await invoiceModel
      .find({ creator: req.user.id })
      .populate({
        path: "customer",
        populate: [
          {
            path: "company",
            model: "Company",
            select: "companyname",
          },
          {
            path: "people",
            model: "People",
            select: "firstname lastname",
          },
        ],
      })
      .populate("creator", "name");
  }

  res.status(200).json({
    status: 200,
    success: true,
    invoices,
  });
});

const deleteInvoice = TryCatch(async (req, res) => {
  const { invoiceId } = req.body;

  const isInvoiceExists = await invoiceModel.findById(invoiceId);
  if (!isInvoiceExists) {
    throw new Error("Invoice doesn't exists", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    isInvoiceExists.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to delete this invoice", 401);
  }

  await invoiceModel.deleteOne({ _id: invoiceId });

  res.status(200).json({
    status: 200,
    success: true,
    message: "Invoice deleted successfully",
  });
});

const getInvoiceDetails = TryCatch(async (req, res) => {
  const { invoiceId } = req.body;

  const isExistingInvoice = await invoiceModel
    .findById(invoiceId)
    .populate({
      path: "customer",
      populate: [
        {
          path: "company",
          model: "Company",
          select: "companyname phone email",
        },
        {
          path: "people",
          model: "People",
          select: "firstname lastname phone email",
        },
      ],
    })
    .populate({
      path: "products.product",
      model: "Product",
      select: "name imageUrl category",
      populate: [
        {
          path: "category",
          model: "Product Category",
          select: "categoryname",
        },
      ],
    })
    .populate("createdBy", "name phone designation");

  if (!isExistingInvoice) {
    throw new Error("Invoice doesn't exists", 404);
  }

  if (
    req.user.role !== "Super Admin" &&
    isExistingInvoice.creator.toString() !== req.user.id.toString()
  ) {
    throw new Error("You are not allowed to access this invoice", 401);
  }

  res.status(200).json({
    status: 200,
    success: true,
    invoice: isExistingInvoice,
  });
});

const downloadInvoice = TryCatch(async (req, res, next) => {
  const { invoiceId } = req.body;

  const invoice = await invoiceModel
    .findById(invoiceId)
    .populate({
      path: "customer",
      populate: [
        {
          path: "company",
          model: "Company",
          select: "companyname phone email",
        },
        {
          path: "people",
          model: "People",
          select: "firstname lastname phone email",
        },
      ],
    })
    .populate({
      path: "products.product",
      model: "Product",
      select: "name price model imageUrl category",
      populate: [
        {
          path: "category",
          model: "Product Category",
          select: "categoryname",
        },
      ],
    })
    .populate("createdBy", "name designation phone");
  if (!invoice) {
    throw new Error("Invoice doesn't exists");
  }

  const date = new Date(invoice?.createdAt);
  const buffers = [];
  const pdf = new PDFTable({
    margin: 15,
    font: "Times-Roman",
  });

  const imagePaths = {};
  const imagePromises = invoice.products.map(async (product, index) => {
    const img = await fetchImage(product.product.imageUrl);
    imagePaths[product.product.imageUrl] = img;
  });

  await Promise.all(imagePromises);

  pdf.image("logo.png", { width: 100, height: 50 });

  pdf.y = 70;

  pdf
    .fontSize(16)
    .fillColor("#038ccc")
    .font("Times-Bold")
    .text("(A Unit Of Bhati Healthcare PVT. LTD.)");

  pdf.y = 135;
  pdf.font("Times-Roman");
  pdf.fillColor("black");
  pdf.fontSize(14);

  pdf.text(
    `Dated: ${
      date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear()
    }`
  );

  pdf.moveUp();
  pdf.font("Times-Bold").text("Validity : 1 month only", 400);
  pdf.moveDown();
  pdf.x = 15;

  pdf.text(
    `${
      invoice?.customer?.people
        ? invoice?.customer?.people.firstname +
          " " +
          (invoice?.customer?.people.lastname || "")
        : invoice?.customer?.company.companyname
    }`
  );
  pdf.font("Times-Roman").text(invoice?.customeraddress || "");

  pdf.moveDown(1);
  pdf.fontSize(20);
  pdf.font("Times-Roman");

  pdf
    .rect(15, pdf.y, pdf.page.width - 35, 33)
    .fill("#038ccc")
    .fill("white")
    .text("INVOICE OF GYM EQUIPMENT", pdf.x, pdf.y + 10, {
      align: "center",
    });

  pdf.y += 4;
  pdf.fillColor("black");
  pdf.fontSize(14);

  const data = invoice?.products.map((product, ind) => {
    return {
      sno: ind + 1,
      modelno: product.product.model,
      name: product.product.name,
      image: product.product.imageUrl,
      qty: product.quantity,
      mrp: "Rs " + product.product.price,
      offerprice: "Rs " + product.price,
      total: "Rs " + product.price * product.quantity,
    };
  });

  const table = {
    options: {
      prepareHeader: () => pdf.font("Times-Roman").fontSize(12),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        pdf.font("Times-Roman").fontSize(12);
      },
    },
    headers: [
      { label: "S.No.", property: "sno", renderer: null },
      { label: "MODEL NO.", property: "modelno", renderer: null },
      { label: "NAME", property: "name", renderer: null },
      {
        label: "IMAGE",
        renderer: (value, indexColumn, indexRow, row, rectRow, rectCell) => {
          pdf.image(imagePaths[value], rectCell.x, rectCell.y + 1, {
            width: rectCell.width,
            height: rectCell.height - 1,
          });
          return "";
        },
        property: "image",
      },
      { label: "QUANTITY", property: "qty", renderer: null },
      { label: "MRP", property: "mrp", renderer: null },
      { label: "OFFER PRICE", property: "offerprice", renderer: null },
      { label: "TOTAL", property: "total", renderer: null },
    ],
    datas: data,
  };
  pdf.table(table);

  pdf
    .fontSize(16)
    .fillColor("#038ccc")
    .text("Total: Rs " + invoice.total, { align: "right" });

  pdf
    .fontSize(16)
    .fillColor("#038ccc")
    .text("Paid: Rs " + invoice.paid, { align: "right" });

  pdf
    .fontSize(16)
    .fillColor("#038ccc")
    .text("Balance: Rs " + invoice.balance, { align: "right" });

  pdf
    .fontSize(16)
    .fillColor("#038ccc")
    .text("Payment Status: " + invoice.paymentstatus, { align: "right" });

  pdf.moveDown();
  pdf.fontSize(20);

  if (pdf.y + 33 > pdf.page.height - 15) {
    pdf.addPage();
  }
  pdf
    .rect(15, pdf.y, pdf.page.width - 35, 33)
    .fill("#038ccc")
    .fill("white")
    .text("WARRANTY", pdf.x, pdf.y + 10, { align: "center" });

  pdf.y += 4;
  pdf.font("Times-Roman");
  pdf.fillColor("black");
  pdf.fontSize(14);

  pdf.text(
    "A). 1 YEAR COMPREHENSIVE WARRANTY FROM THE DATE OF DELIVERY (EXCEPT RUBBER AND PLASTIC PARTS)."
  );
  pdf.text("B). 2 YEARS WARRANTY ON DRIVE OF TREADMILL.");
  pdf.text("C). 5 YEARS WARRANTY ON MOTOR OF TREADMILL.");

  pdf.moveDown();
  pdf.fontSize(20);

  if (pdf.y + 33 > pdf.page.height - 15) {
    pdf.addPage();
  }
  pdf
    .rect(15, pdf.y, pdf.page.width - 35, 33)
    .fill("#038ccc")
    .fill("white")
    .text("TERMS & CONDITIONS", pdf.x, pdf.y + 10, { align: "center" });

  pdf.y += 4;
  pdf.font("Times-Bold");
  pdf.fillColor("#038ccc");
  pdf.fontSize(14);

  pdf.text(
    "SERVO/STABILIZER 5KVA ON EACH TREADMILL IS COMPULSORY, NO WARRANTY/GUARANTEE WITHOUT STABILIZER."
  );

  pdf.font("Times-Roman");
  pdf.fillColor("black");
  pdf.y += 2;

  pdf.text("TAXES: GST EXTRA @ 18%");
  pdf.text("PAYMENT: 100% ADVANCE BEFORE DELIVERY.");
  pdf.text("DELIVERY: WITHIN 3 TO 4 WEEKS");
  pdf.text("FREIGHT: EXTRA AS PER ACTUAL");
  pdf.text("UNLOADING: EXTRA");
  pdf.text("INSTALLATION: FREE");

  pdf.moveDown();
  pdf.fontSize(20);

  if (pdf.y + 33 > pdf.page.height - 15) {
    pdf.addPage();
  }
  pdf
    .rect(15, pdf.y, pdf.page.width - 35, 33)
    .fill("#038ccc")
    .fill("white")
    .text("BANK DETAILS", pdf.x, pdf.y + 10, { align: "center" });

  pdf.y += 4;
  pdf.font("Times-Roman");
  pdf.fillColor("black");
  pdf.fontSize(14);

  pdf.text("NAME: BHATI HEALTHCARE PVT. LTD.");
  pdf.text("BANK NAME: UCO BANK");
  pdf.text("ACCOUNT NO.: 03900510001257");
  pdf.text("IFSC CODE: UCBA0000390");
  pdf.text("BRANCH: MAIN BRANCH FARIDABAD");

  pdf.moveDown();

  pdf.text("NAME: BHATI HEALTHCARE PVT. LTD.");
  pdf.text("BANK NAME: KOTAK MAHINDRA BANK");
  pdf.text("ACCOUNT NO.: 4249522057");
  pdf.text("IFSC CODE: KKBK0004335");
  pdf.text("BRANCH: 5E/1, B.P RAILWAY ROAD, FARIDABAD");

  pdf.moveDown(2);

  pdf.font("Times-Bold");
  pdf.fillColor("#038ccc");

  pdf.text("Thanks & Regards");
  pdf.moveDown();
  pdf.text(invoice.createdBy.name);
  pdf.text(`(${invoice.createdBy.designation})`);
  pdf.text(`Mobile No: ${invoice.createdBy.phone}`);
  pdf.text(
    "Kuber Tower, Sector-20B, Opp: Thomson Press, Ajronda, Faridabad (HARYANA) - 121007"
  );

  pdf.on("data", buffers.push.bind(buffers));
  pdf.on("end", () => {
    let pdfData = Buffer.concat(buffers);
    res
      .writeHead(200, {
        "Content-Length": Buffer.byteLength(pdfData),
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment;filename=invoice-${
          invoice?.customer?.people
            ? invoice?.customer?.people.firstname +
              " " +
              (invoice?.customer?.people.lastname || "")
            : invoice?.customer?.company.companyname
        }-${invoice._id}.pdf`,
      })
      .end(pdfData);
  });
  pdf.end();
});

module.exports = {
  createInvoice,
  getAllInvoices,
  deleteInvoice,
  editInvoice,
  getInvoiceDetails,
  downloadInvoice,
};