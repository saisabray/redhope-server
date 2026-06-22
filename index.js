const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

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

    // Get all users
    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (err) {
        console.error("Error fetching users:", err);
        res.status(500).send({ message: "Failed to fetch users", error: err.message });
      }
    });

    // Get single user by id
    app.get("/users/:id", async (req, res) => {
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
    app.patch("/users/:id/status", async (req, res) => {
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
    app.patch("/users/:id/role", async (req, res) => {
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
    app.patch("/users/:id/profile", async (req, res) => {
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
    app.post("/donation-requests", async (req, res) => {
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
    app.get("/donation-requests/my/:email", async (req, res) => {
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

   

    // Root health check

    app.get("/", (req, res) => {
      res.send("Redhope server is running!");
    });

  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
