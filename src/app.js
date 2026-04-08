const express = require("express");
const app = express();

const cron = require('node-cron');
const { markAbsent } = require('./controllers/attendanceController');



app.use(express.json());

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "DELETE,GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin,X-Requested-With,Content-Type,Authorization");
    next();
})

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/employee", require("./routes/employeeRoutes"));
app.use('/api/admin/users', require('./routes/userRoutes'));
app.use('/api/admin/attendance',  require('./routes/attendanceRoutes'));
app.use('/api/admin/leaves',  require('./routes/leaveRoutes'));
app.use('/api/admin/reports', require('./routes/reportRoutes'));
app.use('/api/admin/settings', require('./routes/settingsRoutes'));
app.use('/api/admin/site-visit', require('./routes/adminRoutes'));


// Schedule to run at 11:59 PM every day
cron.schedule('59 23 * * *', async () => {
  console.log('Running markAbsent cron job at 11:59 PM...');
  try {
    await markAbsent();
    console.log('markAbsent completed successfully');
  } catch (err) {
    console.error('markAbsent cron job failed:', err);
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));
// Example Protected API
const protect = require("./middleware/authMiddleware");

app.get("/api/protected", protect, (req, res) => {
  res.json({ message: "Access Granted", user: req.user });
});

app.get('/', (req,res)=>{
    res.json({status : 'true', message : 'APIs are working'})
})

app.listen(5000, () => {
  console.log(`Server running on port ${'http://localhost:5000/'}`);
});