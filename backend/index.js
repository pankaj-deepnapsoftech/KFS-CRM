const express = require('express');
const {Server} = require('socket.io');
const {createServer} = require('http');
const cookieParser = require('cookie-parser');
require("dotenv").config();
const cors = require("cors");
const cron = require('node-cron');

const connectDB = require("./utils/connectDB");
const { errorMiddleware } = require("./helpers/error");
const authRoutes = require("./routes/auth/routes");
const companyRoutes = require("./routes/company/routes");
const peopleRoutes = require("./routes/people/routes");
const customerRoutes = require("./routes/customer/routes");
const leadRoutes = require("./routes/lead/routes");
const productRoutes = require("./routes/product/routes");
const categoryRoutes = require("./routes/category/routes");
const expenseRoutes = require("./routes/expense/routes");
const expenseCategoryRoutes = require("./routes/expense category/routes");
const offerRoutes = require("./routes/offer/routes");
const proformaInvoiceRoutes = require("./routes/proforma invoice/routes");
const invoiceRoutes = require("./routes/invoice/routes");
const paymentRoutes = require("./routes/payment/routes");
const dashboardRoutes = require("./routes/dashboard/routes");
const adminRoutes = require("./routes/admin/routes");
const reportRoutes = require("./routes/report/routes");
const websiteCofigurationRoutes = require("./routes/website configuration/routes");
const supportRoutes = require("./routes/support/routes");
const indiamartLeadRoutes = require("./routes/indiamart lead/routes");
const notificationRoutes = require("./routes/notification/routes");

const { isAuthenticated } = require("./controllers/auth/controller");
const { checkAccess } = require("./helpers/checkAccess");
const websiteConfigurationModel = require("./models/websiteConfiguration");
const { fetchLast7Days, fetchLast5Mins } = require("./controllers/indiamart lead/controller");
const { socketAuthenticator } = require('./helpers/socket');
const createNotifications = require('./helpers/createNotifications');

const PORT = process.env.PORT;

// Define your allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "https://crmkfs.deepmart.shop",
  "https://kfsecommerce.deepmart.shop",
];

// CORS options
const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  allowedHeaders: "Authorization,Content-Type",
  preflightContinue: false,
  optionsSuccessStatus: 204, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  exposedHeaders: ["Content-Disposition"],
  credentials: true
};


const app = express();
const server = createServer(app);
const io = new Server(server, {cors: corsOptions});

app.use(cors(corsOptions));
app.use(express.json());
app.set("io", io);

app.use("/api/auth", authRoutes);
app.use("/api/company", isAuthenticated, companyRoutes);
app.use("/api/people", isAuthenticated, peopleRoutes);
app.use("/api/customer", isAuthenticated, customerRoutes);
app.use("/api/lead", isAuthenticated, leadRoutes);
app.use("/api/product", isAuthenticated, productRoutes);
app.use("/api/category", isAuthenticated, categoryRoutes);
app.use("/api/expense", isAuthenticated, expenseRoutes);
app.use(
  "/api/expense-category",
  isAuthenticated,
  expenseCategoryRoutes
);
app.use("/api/offer", isAuthenticated, offerRoutes);
app.use(
  "/api/proforma-invoice",
  isAuthenticated,
  checkAccess,
  proformaInvoiceRoutes
);
app.use("/api/invoice", isAuthenticated, invoiceRoutes);
app.use("/api/payment", isAuthenticated, paymentRoutes);
app.use("/api/dashboard", isAuthenticated, dashboardRoutes);
app.use("/api/admin", isAuthenticated, adminRoutes);
app.use("/api/report", isAuthenticated, reportRoutes);
app.use("/api/website-configuration", isAuthenticated, websiteCofigurationRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/indiamart", indiamartLeadRoutes);
app.use("/api/notification", isAuthenticated, notificationRoutes);


// Fetch Indiamart Leads
// fetchLast7Days();
setInterval(fetchLast5Mins, 5*60*1000);

const emailToSocketId = new Map();

io.use((socket, next)=>{
  cookieParser()(socket.request, socket.request.res, async (err)=> await socketAuthenticator(err, socket, next));
});

io.on('connection', (socket)=>{
  emailToSocketId.set(socket.user.email, socket.id);
  
  // socket.on('disconnect', () => {
  //   console.log("User disconnected", socket.id);
  // });
})

app.use(errorMiddleware);

// Runs everyday at 12:00 am
cron.schedule("0 0 * * *", createNotifications);

server.listen(PORT, () => {
  connectDB();
  console.log("Server is listening on Port:", PORT);
});

exports.emailToSocketId = emailToSocketId;