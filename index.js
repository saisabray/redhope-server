const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
const JWKS =createRemoteJWKSet(new URL(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/jwks`))
const uri = process.env.MONGODB_URI;

const verifyToken = async (req, res, next) => {
    try{
    const authHeader=req.headers.authorization
    if(!authHeader || !authHeader.startsWith('Bearer ')){
      return res.status(401).send({message:'Unauthorized access'})
    }
      const token = authHeader.split(' ')[1]
      if(!token){
        return res.status(401).send({message:'Unauthorized access'})
      } 
      const { payload } = await jwtVerify(token, JWKS);
      req.user = payload;
      next()
    } catch (error) {
      console.log(error)
      res.status(401).send({ message: 'Invalid token' })
      
    }
  }
  
  const verifyAdmin = async (req, res, next) => {
    const user = req.user;
    if (user?.role !== "admin") {
      return res.status(403).send({ message: "Forbidden access" });
    }
    next();
  };

  const verifyDonor = async (req, res, next) => {
    const user = req.user;
    if (user?.role !== "donor") {
      return res.status(403).send({ message: "Forbidden access" });
    }
    next();
  };

  const verifyVolunteer = async (req, res, next) => {
    const user = req.user;
    if (user?.role !== "volunteer") {
      return res.status(403).send({ message: "Forbidden access" });
    }
    next();
  };
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const database = client.db("redhope");
    const usersCollection = database.collection("user");
    const donationRequestsCollection = database.collection("donationRequests");
    const fundingCollection = database.collection("funding");

    //Funding
    app.post("/funding", verifyToken, async(req,res)=>{
        try{
            const {sessionID,userId,amount,stripeId} = req.body
            const result = await fundingCollection.insertOne({
              sessionID,
              userId,
              amount,
              stripeId,
              createdAt: new Date().toISOString()
            })
            res.send({message:"Funding created successfully.",id:result.insertedId})
        }catch(err){
            console.error("Error creating funding:",err)
            res.status(500).send({message:"Failed to create funding.",error:err.message})
        }
    })  

    // Get all funding records
    app.get("/funding", verifyToken, async (req, res) => {
      try {
        const result = await fundingCollection.aggregate([
          {
            $addFields: {
              userObjId: { $toObjectId: "$userId" }
            }
          },
          {
            $lookup: {
              from: "user",
              localField: "userObjId",
              foreignField: "_id",
              as: "user"
            }
          },
          {
            $unwind: { path: "$user", preserveNullAndEmptyArrays: true }
          },
          {
            $project: {
              _id: 1,
              amount: 1,
              createdAt: 1,
              userName: "$user.name",
              userEmail: "$user.email"
            }
          },
          {
            $sort: { createdAt: -1 }
          }
        ]).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching fundings:", err);
        res.status(500).send({ message: "Failed to fetch fundings", error: err.message });
      }
    });

    // Get all users
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send({ message: "Failed to fetch users", error: err.message });
      }
    });

    // Search donors by bloodGroup, district, upazila (must be before /users/:id)
    app.get("/users/search", async (req, res) => {
      try {
        const { bloodGroup, district, upazila } = req.query;

        // Always scope to active donors only
        const query = {
          role: "donor",
          status: { $ne: "blocked" },
        };

        if (bloodGroup) query.bloodGroup = bloodGroup;
        if (district)   query.district   = district;
        if (upazila)    query.upazila    = upazila;

        const result = await usersCollection
          .find(query, { projection: { name: 1, email: 1, image: 1, bloodGroup: 1, district: 1, upazila: 1, role: 1, status: 1 } })
          .sort({ name: 1 })
          .toArray();

        res.send(result);
      } catch (err) {
        console.error("Error searching donors:", err);
        res.status(500).send({ message: "Failed to search donors.", error: err.message });
      }
    });

    // Get single user by id
    app.get("/users/:id", verifyToken, async (req, res) => {
      try {
        const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!user) return res.status(404).send({ message: "User not found" });
        res.send(user);
      } catch (err) {
        console.error("Error fetching user:", err);
        res.status(500).send({ message: "Failed to fetch user", error: err.message });
      }
    });

    // Block / Unblock a user
    app.patch("/users/:id/status", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { status } = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { status } }
        );
        if (result.matchedCount === 0)
          return res.status(404).send({ message: "User not found" });
        res.send({ message: `User status updated to ${status}` });
      } catch (err) {
        console.error("Error updating user status:", err);
        res.status(500).send({ message: "Failed to update user status", error: err.message });
      }
    });

    // Update user role
    app.patch("/users/:id/role", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { role } = req.body;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: { role } }
        );
        if (result.matchedCount === 0)
          return res.status(404).send({ message: "User not found" });
        res.send({ message: `User role updated to ${role}` });
      } catch (err) {
        console.error("Error updating user role:", err);
        res.status(500).send({ message: "Failed to update user role", error: err.message });
      }
    });

    // Update user profile (name, image, bloodGroup, district, upazila)
    app.patch("/users/:id/profile", verifyToken, async (req, res) => {
      try {
        const { name, image, bloodGroup, district, upazila } = req.body;
        const updateFields = {};
        if (name       !== undefined) updateFields.name       = name;
        if (image      !== undefined) updateFields.image      = image;
        if (bloodGroup !== undefined) updateFields.bloodGroup = bloodGroup;
        if (district   !== undefined) updateFields.district   = district;
        if (upazila    !== undefined) updateFields.upazila    = upazila;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateFields }
        );
        if (result.matchedCount === 0)
          return res.status(404).send({ message: "User not found" });
        res.send({ message: "Profile updated successfully" });
      } catch (err) {
        console.error("Error updating profile:", err);
        res.status(500).send({ message: "Failed to update profile", error: err.message });
      }
    });

    // ── Donation Requests ────────────────────────────────────────────────────

    // Create a new donation request
    app.post("/donation-requests", verifyToken, verifyDonor, async (req, res) => {
      try {
        const {
          requesterName, requesterEmail, requesterId,
          recipientName, recipientDistrict, recipientUpazila,
          hospitalName, fullAddress, bloodGroup,
          donationDate, donationTime, requestMessage,
          status, createdAt,
        } = req.body;

        if (!requesterName || !requesterEmail || !recipientName ||
            !recipientDistrict || !recipientUpazila || !hospitalName ||
            !fullAddress || !bloodGroup || !donationDate ||
            !donationTime || !requestMessage) {
          return res.status(400).send({ message: "All fields are required." });
        }

        const doc = {
          requesterName,
          requesterEmail,
          requesterId,
          recipientName,
          recipientDistrict,
          recipientUpazila,
          hospitalName,
          fullAddress,
          bloodGroup,
          donationDate,
          donationTime,
          requestMessage,
          status: status || "pending",
          createdAt: createdAt || new Date().toISOString(),
        };

        const result = await donationRequestsCollection.insertOne(doc);
        res.status(201).send({ message: "Donation request created successfully.", id: result.insertedId });
      } catch (err) {
        console.error("Error creating donation request:", err);
        res.status(500).send({ message: "Failed to create donation request.", error: err.message });
      }
    });

    // Get all donation requests
    app.get("/donation-requests", async (req, res) => {
      try {
        const result = await donationRequestsCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching donation requests:", err);
        res.status(500).send({ message: "Failed to fetch donation requests.", error: err.message });
      }
    });

    // Get donation requests by requester email
    app.get("/donation-requests/my/:email", verifyToken, async (req, res) => {
      try {
        const result = await donationRequestsCollection
          .find({ requesterEmail: req.params.email })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching user donation requests:", err);
        res.status(500).send({ message: "Failed to fetch donation requests.", error: err.message });
      }
    });

    // Get single donation request by ID
    app.get("/donation-requests/:id", async (req, res) => {
      try {
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!request) return res.status(404).send({ message: "Donation request not found." });
        res.send(request);
      } catch (err) {
        console.error("Error fetching donation request:", err);
        res.status(500).send({ message: "Failed to fetch donation request.", error: err.message });
      }
    });

    // Update donation request 
    app.patch("/donation-requests/:id", verifyToken, verifyDonor, async (req, res) => {
      try {
        const {
          recipientName, recipientDistrict, recipientUpazila,
          hospitalName, fullAddress, bloodGroup,
          donationDate, donationTime, requestMessage,
        } = req.body;

        const updateFields = {};
        if (recipientName     !== undefined) updateFields.recipientName     = recipientName;
        if (recipientDistrict !== undefined) updateFields.recipientDistrict = recipientDistrict;
        if (recipientUpazila  !== undefined) updateFields.recipientUpazila  = recipientUpazila;
        if (hospitalName      !== undefined) updateFields.hospitalName      = hospitalName;
        if (fullAddress       !== undefined) updateFields.fullAddress       = fullAddress;
        if (bloodGroup        !== undefined) updateFields.bloodGroup        = bloodGroup;
        if (donationDate      !== undefined) updateFields.donationDate      = donationDate;
        if (donationTime      !== undefined) updateFields.donationTime      = donationTime;
        if (requestMessage    !== undefined) updateFields.requestMessage    = requestMessage;
        updateFields.updatedAt = new Date().toISOString();

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateFields }
        );
        if (result.matchedCount === 0)
          return res.status(404).send({ message: "Donation request not found." });
        res.send({ message: "Donation request updated successfully." });
      } catch (err) {
        console.error("Error updating donation request:", err);
        res.status(500).send({ message: "Failed to update donation request.", error: err.message });
      }
    });

    // Update donation request status 
    app.patch("/donation-requests/:id/status", verifyToken, verifyDonor, async (req, res) => {
      try {
        const { status, donorName, donorEmail, donorId } = req.body;
        const updateFields = { status };
        if (donorName)  updateFields.donorName  = donorName;
        if (donorEmail) updateFields.donorEmail = donorEmail;
        if (donorId)    updateFields.donorId    = donorId;
        if (status === "inprogress") updateFields.acceptedAt = new Date().toISOString();

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updateFields }
        );
        if (result.matchedCount === 0)
          return res.status(404).send({ message: "Donation request not found." });
        res.send({ message: `Donation request status updated to ${status}.` });
      } catch (err) {
        console.error("Error updating donation request status:", err);
        res.status(500).send({ message: "Failed to update status.", error: err.message });
      }
    });


    // Delete a donation request
    app.delete("/donation-requests/:id", verifyToken, async (req, res) => {
      try {
        const result = await donationRequestsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0)
          return res.status(404).send({ message: "Donation request not found." });
        res.send({ message: "Donation request deleted successfully." });
      } catch (err) {
        console.error("Error deleting donation request:", err);
        res.status(500).send({ message: "Failed to delete donation request.", error: err.message });
      }
    });

    // Admin/Volunteer stats overview
    app.get("/admin/stats", verifyToken, async (req, res, next) => {
      if (req.user?.role !== "admin" && req.user?.role !== "volunteer") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    }, async (req, res) => {
      try {
        const totalDonors = await usersCollection.countDocuments({ role: "donor" });
        const totalRequests = await donationRequestsCollection.countDocuments();
        const fundingAgg = await fundingCollection.aggregate([
          { $group: { _id: null, totalFunding: { $sum: "$amount" } } }
        ]).toArray();
        const totalFunding = fundingAgg.length > 0 ? fundingAgg[0].totalFunding : 0;

        res.send({
          totalDonors,
          totalFunding,
          totalRequests
        });
      } catch (err) {
        console.error("Error fetching stats:", err);
        res.status(500).send({ message: "Failed to fetch stats.", error: err.message });
      }
    });

    // Root health check
    app.get("/", (req, res) => {
      res.send("Redhope server is running!");
    });

    // Start listening only after DB is connected and routes are registered
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

  } catch (error) {
    console.error("Fatal: Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

run().catch(console.dir);
