const express = require("express");
const app = express();
const mongoose = require("mongoose");
const router = express.Router();
// importing mongo models
const ReporterModel = require("../models/Reporter");
const HospitalModel = require("../models/Hospital");
const WardenModel = require("../models/Warden");
const AdminModel = require("../models/Admin");
const Report = require("../models/Reports");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

router.get("/repList", (req, res) => {
    ReporterModel.find({ approved: { $ne: 0, $ne: 3 } }).then(function (lists) {
        res.json(lists);
    });
});

router.get("/notApprovedRep", (req, res) => {
    ReporterModel.find({ approved: 0 }).then(function (lists) {
        res.json(lists);
    });
});

router.get("/notApprovedHosp", (req, res) => {
    HospitalModel.find({ approved: 0 }).then(function (lists) {
        res.json(lists);
    });
});

router.post("/approveRep", async (req, res) => {
    const { number } = req.body;
    await ReporterModel.updateOne({ number: number }, { approved: 1 });
    res.json({ message: "User approved" });
});

router.post("/rejectRep", async (req, res) => {
    const { number } = req.body;
    await ReporterModel.updateOne({ number: number }, { approved: 3 });
    res.json({ message: "User rejected" });
});

router.post("/blockRep", async (req, res) => {
    const { number } = req.body;
    await ReporterModel.updateOne({ number: number }, { approved: 5 });
    res.json({ message: "User rejected" });
});

router.post("/approveHosp", async (req, res) => {
    const { number } = req.body;
    await HospitalModel.updateOne({ p_number: number }, { approved: 1 });
    res.json({ message: "User approved" });
});

router.post("/rejectHosp", async (req, res) => {
    const { number } = req.body;
    await HospitalModel.updateOne({ p_number: number }, { approved: 3 });
    res.json({ message: "User rejected" });
});

router.post("/signupRep", async (req, res) => {
    const { cnic, number, name, email, password } = req.body;
    const fetchUserRep = await ReporterModel.findOne({
        $or: [{ email: email }, { number: number }],
    });
    const fetchUserHosp = await HospitalModel.findOne({
        $or: [{ email: email }, { p_number: number }],
    });
    if (fetchUserRep || fetchUserHosp) {
        res.json({
            message: "A user with this email or number already exists",
        });
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new ReporterModel({
        cnic,
        number,
        name,
        email,
        password: hashedPassword,
        approved: 0,
    });
    await newUser.save();
    res.json({ message: "User Registered Succesfully" });
});

router.post("/signupHosp", async (req, res) => {
    const {
        name,
        address,
        email,
        password,
        landline,
        p_number,
        s_number,
        doctors,
        ambulances,
        longitude,
        latitude,
    } = req.body;
    const fetchUserHosp = await HospitalModel.findOne({
        $or: [{ email: email }, { p_number: p_number }],
    });
    const fetchUserRep = await ReporterModel.findOne({
        $or: [{ email: email }, { number: p_number }],
    });
    if (fetchUserHosp || fetchUserRep) {
        res.json({
            message: "A user with this email or number already exists",
        });
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new HospitalModel({
        name,
        address,
        email,
        password: hashedPassword,
        landline,
        p_number,
        s_number,
        doctors,
        ambulances,
        approved: 0,
        location: [longitude, latitude],
    });
    await newUser.save();

    res.json({ success: 1, message: "User Registered Succesfully" });
});

router.post("/signupWard", async (req, res) => {
    const { name, number, email, address, password } = req.body;
    const fetchUserHosp = await HospitalModel.findOne({
        $or: [{ email: email }, { p_number: number }],
    });
    const fetchUserRep = await ReporterModel.findOne({
        $or: [{ email: email }, { number: number }],
    });
    const fetchUserWard = await WardenModel.findOne({
        $or: [{ email: email }, { number: number }],
    });
    if (fetchUserHosp || fetchUserRep || fetchUserWard) {
        res.json({
            success: 0,
            message: "A user with this email or number already exists",
        });
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new WardenModel({
        number,
        name,
        email,
        address,
        password: hashedPassword,
        approved: 1,
    });
    await newUser.save();

    res.json({ success: 1, message: "User Registered Succesfully" });
});

router.post("/login", async (req, res) => {
    const { number, password } = req.body;
    const fetchUserRep = await ReporterModel.findOne({ number: number });
    const fetchUserHosp = await HospitalModel.findOne({ p_number: number });
    const fetchUserWard = await WardenModel.findOne({ number: number });
    const fetchUserAdmin = await AdminModel.findOne({ number: number });

    if (!fetchUserRep && !fetchUserHosp && !fetchUserWard && !fetchUserAdmin) {
        res.json({ message: "No such user exists" });
        return;
    }

    let fetchUser = fetchUserRep;
    if (fetchUserAdmin) {
        fetchUser = fetchUserAdmin;
    }
    if (fetchUserHosp) {
        fetchUser = fetchUserHosp;
    }
    if (fetchUserWard) {
        fetchUser = fetchUserWard;
    }

    const isValid = fetchUserAdmin
        ? password === fetchUser.password
        : await bcrypt.compare(password, fetchUser.password);
    if (!isValid) {
        return res.json({ message: "Incorrect Password" });
    }

    if (fetchUserRep) {
        if (fetchUserRep.approved !== 1) {
            return res.json({ message: "User not approved" });
        }
    }
    if (fetchUserHosp) {
        if (fetchUserHosp.approved !== 1) {
            return res.json({ message: "User not approved" });
        }
    }

    if (fetchUserWard) {
        if (fetchUserWard.approved !== 1) {
            return res.json({ message: "User not approved" });
        }
    }

    const token = jwt.sign({ id: fetchUser._id }, "secret");
    res.json({
        token,
        userID: fetchUser._id,
        type: fetchUserHosp
            ? "Hospital"
            : fetchUserWard
            ? "Warden"
            : fetchUserAdmin
            ? "Admin"
            : "Reporter",
    });
});

// moving on to the lists part where we have to show the lists to the actors
// this method will return all the pending open requests for the police
router.get("/policePending", async (req, res) => {
    try {
        const reports = await Report.find({ status: "accepted_hospital" })
            .sort({ createdAt: -1 })
            .exec();

        res.json(reports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});
// this function will accept and reject the requests from the police end
router.put("/policePendingAccepted/:id", async (req, res) => {
    try {
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status: "accepted_police" },
            { new: true }
        );
        res.send(report);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

// Update report status to rejected
router.put("/policePendingRejected/:id", async (req, res) => {
    try {
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status: "rejected" },
            { new: true }
        );
        res.send(report);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

router.get("/hospitalPending", async (req, res) => {
    try {
        const reports = await Report.find({ status: "open" })
            .sort({ createdAt: -1 })
            .exec();
        res.json(reports);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

// this is will process the accept and rejects from the hospitals
router.put("/hospitalPendingAccepted/:id", async (req, res) => {
    const hospital_id = req.body.hospital_id;
    try {
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status: "accepted_hospital", hospital_id: hospital_id },
            { new: true }
        );
        res.send(report);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

// Update report status to rejected
router.put("/hospitalPendingRejected/:id", async (req, res) => {
    try {
        const report = await Report.findByIdAndUpdate(
            req.params.id,
            { status: "rejected" },
            { new: true }
        );
        res.send(report);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal server error");
    }
});

router.post("/getHospitalDetails", async (req, res) => {
    try {
        console.log("Request Rcvd");
        console.log(req.body);
        const hospitaldeets = await HospitalModel.findById(req.body.userID);
        console.log(hospitaldeets);

        res.send(hospitaldeets);
    } catch (error) {
        console.log(error);
    }
});

router.post("/updateHospital", async (req, res) => {

    console.log("Update Hospital Request Recieved")
    try {
    const hospitalUpdate = await HospitalModel.findByIdAndUpdate(
        req.body.hosp_id,
        {landline: req.body.landline },
        {p_number: req.body.primaryMobileNumber},
        {s_number: req.body.secondaryMobileNumber},
        {doctors: req.body.numOnCallDoctors },
        {ambulances: req.body.numOperationalAmbulances},
        {password: req.body.newPassword }
        );

       console.log("Updated Successfully!") 
    } catch(error) {
        console.log(error)
    }



});

router.post("/updateReporters", async (req, res) => {
    // get user id
    // update reporter fields in mongo
    console.log("Update Reporter Request Recieved")
    try {
    const reporterUpdate = await ReporterModel.findByIdAndUpdate(
        req.body.user_id,
        {number: req.body.number },
        {name: req.body.displayName},
        {password: req.body.newPassword},
        );

       console.log("Updated Successfully!") 
    } catch(error) {
        console.log(error)
    }



});

module.exports = router;
