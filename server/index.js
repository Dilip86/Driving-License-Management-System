var express = require("express");
var cors = require("cors");
var multer = require("multer");
var twilio = require("twilio");
var bodyParser = require("body-parser");
var mongoClient = require("mongodb").MongoClient;
const mongoose = require("mongoose");
var path = require("path");
const { ObjectId } = require('mongodb');

const corsOptions = {
    origin: 'http://127.0.0.1:5500',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  };

  const accountSid = 'AC90f46dd8f7f6d3c52ad8d85f5f2bec64';
  const authToken = 'c9c3945ba599d9f851c0de78e9ca294e';
  const client = twilio(accountSid, authToken);
  
  



var constring = "mongodb://127.0.0.1:27017";
// const constring = 'mongodb+srv://satish-DLMS-project:7978839802s@satish1.fgdqllw.mongodb.net/?retryWrites=true&w=majority';

var app = express();
app.use(cors());
app.use(express.urlencoded({extended:true}));
app.use(express.json());
app.use(express.static(path.join(__dirname,"..", "client", "public"))); // Serve static files from "public" directory
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(cors(corsOptions));
app.use(bodyParser.json());


// connection for getting aadhar details
app.get("/aadharDetails", (req, res)=>{
    mongoClient.connect((constring)).then((clientObj)=>{
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_main").find({}).toArray().then((docs)=>{
            res.send(docs);
            res.end();
        });
    });
});

// to get users details
app.get("/users", (req, res)=>{
    mongoClient.connect((constring)).then((clientObj)=>{
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_Users").find({}).toArray().then((docs)=>{
            res.send(docs);
            res.end();
        });
    });
});

function sendCongratulationsSMS(toPhone) {
    client.messages
        .create({
            body: 'Congratulations! You have created your account successfully for the Driving License process.',
            from: '+12104174815',
            to: toPhone
        })
        .then((message) => {
            console.log('SMS sent with SID:', message.sid);
            console.log('User phone number:', toPhone);
        })
        .catch((error) => {
            console.error('Error sending SMS:', error);
        });
}

//for adding user in the database of tbl_Users collection
app.post("/adduser", (req, res) => {
    var user = {
        aadharNumber: req.body.aadharNumber,
        password: req.body.password,
        repassword: req.body.repassword,
    };

    // Save the user to tbl_Users
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_Users").insertOne(user).then(() => {
            // Retrieve the user's phone number from tbl_main
            database.collection("tbl_main").findOne({ aadharNumber: user.aadharNumber }, (err, mainUser) => {
                if (!err && mainUser) {
                    const userPhone = mainUser.phone;
                    // Send the "Congratulations" SMS
                    sendCongratulationsSMS(userPhone);
                }
            });

            // Send a response indicating successful registration
            res.status(200).json({ message: "User registered successfully" });
        }).catch((err) => {
            console.error("Error adding user: " + err);
            res.status(500).json({ error: "An error occurred while registering." });
        });
    });
});

//here if user is forgot his password then he can reset here his password
app.put('/resetPassword/:aadharNumber', (req, res)=>{
    var aadharNumber = req.params.aadharNumber;
    const resetPasswordData = req.body;
    mongoClient.connect(constring).then((clientObj)=>{
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_Users").updateOne({aadharNumber:aadharNumber},{$set:resetPasswordData})
        .then(()=>{
            console.log("Password reset success...")
            res.sendStatus(204);
        })
        .catch((err)=>console.error(err));
    })
})




//here i will take the input from user and store them in tbl_LLform (it have some fields that have
// auto filled from the tbl_main table)

app.post("/addLLData", (req,res)=>{
    var lldata ={
        aadharNumber: req.body.aadharNumber,
        fullName: req.body.fullName,
        dateOfBirth: req.body.dateOfBirth,
        gender: req.body.gender,
        phone: req.body.phone,
        email: req.body.email,
        organDonor: req.body.organDonor,
        bloodGroup: req.body.bloodGroup,
        classOfVehicle: req.body.classOfVehicle,
    };

    const referenceNumber = generateUniqueReferenceNumber(req.body.aadharNumber);
    lldata.LLreferenceNumber = referenceNumber;

    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_LLForm").insertOne(lldata).then(() => {
            console.log("Data Added Successfully");
            res.json({ referenceNumber }); // Send the reference number as a JSON response
        })
        .catch((err) => {
            console.error("Error adding data: " + err);
            res.status(500).json({ error: "An error occurred while storing data." });
        })
        .finally(() => {
            res.end();
        });
    });
});


// Function to generate a unique reference number
function generateUniqueReferenceNumber(aadharNumber) {
    // Generate a unique reference number based on a timestamp, a random four-digit number, and the user's Aadhar number.
    const timestamp = Date.now();
    const randomFourDigitNumber = Math.floor(1000 + Math.random() * 9000); // Random four-digit number

    return `${new Date(timestamp).getFullYear()}${randomFourDigitNumber}${aadharNumber}`;
}

// to get llData
app.get("/llFormData", (req, res)=>{
    mongoClient.connect((constring)).then((clientObj)=>{
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_LLForm").find({}).toArray().then((docs)=>{
            res.send(docs);
            res.end();
        });
    });
});


//for image upload
mongoose.connect("mongodb://127.0.0.1:27017/Driving-License-Db", {
    useNewUrlParser: true,
    useUnifiedTopology: true
});




const uploadSchema = new mongoose.Schema({
    aadharNumber: String,
    signature: Buffer,
}, { collection: "tbl_Uploads" });

const Upload = mongoose.model("Upload", uploadSchema);

// Configure multer for signature and photo uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post("/upload", upload.single("signatureImage"), async (req, res) => {
    const aadharNumber = req.body.aadharNumber; // Get Aadhar number from the form

    if (!aadharNumber) {
        return res.status(400).json({ error: "Aadhar number is required." });
    }

    const signatureImage = req.file;

    if (!signatureImage) {
        return res.status(400).json({ error: "Signature image is required." });
    }


    const uploadData = new Upload({
        aadharNumber,
        signature: signatureImage.buffer,
        
    });

    try {
        // Save the signature and photo data
        await uploadData.save();
        console.log("Signature data added successfully");
        res.status(200).json({ message: "Signature data added successfully" });
    } catch (error) {
        console.error("Error adding signature  data: " + error);
        res.status(500).json({ error: "An error occurred while storing the data." });
    }
});



//to get photo uploads
app.get("/uploads", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_Uploads").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

// for captured photo

mongoose.connect('mongodb://127.0.0.1:27017/Driving-License-Db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Create a schema for image uploads
const photoUploadSchema = new mongoose.Schema({
    aadharNumber: String,
  image: Buffer, // Binary image data
},{
    collection: 'tbl_CapturedPhoto'
});

const captureUpload = mongoose.model('CaptureUpload', photoUploadSchema);

// Set up multer for handling file uploads
const PhotoUploadStorage = multer.memoryStorage();
const photoUpload = multer({ storage: PhotoUploadStorage });

// Handle POST requests to upload an image
app.post('/capturedPhoto', photoUpload.single('image'), async (req, res) => {
    // If multer didn't find a file in the request, it will return an error
    if (req.file) {
        try {
            // Create a new instance of Upload

            const { aadharNumber } = req.body;
            const newUpload = new captureUpload({
                aadharNumber: aadharNumber, // Store the aadharNumber
                image: req.file.buffer, // Store the binary image data
            });

            // Save the image data to the database
            await newUpload.save();

            res.status(200).json({ message: 'Image uploaded and saved successfully.' });
        } catch (error) {
            res.status(500).json({ error: 'An error occurred while saving the image.' });
        }
    } else {
        res.status(400).json({ error: 'No image file provided' });
    }
});

app.get("/capturedPhoto", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_CapturedPhoto").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

// for LL feeData
app.post('/LLfeeData', (req, res) => {
    const feeData = {
        aadharNumber: req.body.aadharNumber,
        totalFee: req.body.totalFee,
        classOfVehicle: req.body.classOfVehicle,
        paymentReferenceNumber: req.body.referenceNumber
    };

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_feesPayment").insertOne(feeData)
                .then(() => {
                    console.log("Fees Data added successfully");
                    res.status(200).json({ message: "Fees Data added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding Fees Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});


app.get("/LLfeeData", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_feesPayment").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

//for admin table connection

app.get("/adminData", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_admin").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});


// for fetching the combined data
app.get("/fetchCombinedData", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");

        database.collection("tbl_LLForm").aggregate([
            {
                $lookup: {
                    from: "tbl_feesPayment",
                    localField: "aadharNumber",
                    foreignField: "aadharNumber",
                    as: "combinedData"
                }
            },
            {
                $unwind: "$combinedData"
            },
            {
                $sort: { "combinedData.timestamp": -1 } // Sort by timestamp in descending order
            },
            {
                $group: {
                    _id: "$_id",
                    aadharNumber: { $first: "$aadharNumber" },
                    // Add other fields you need from tbl_LLForm
                    LLreferenceNumber : { $first : "$LLreferenceNumber" },
                    combinedData: { $push: "$combinedData" }
                }
            }
        ]).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});


//post exam credentials
app.post('/examCredentials', (req, res) => {
    const examCredentials = {
        aadharNumber: req.body.aadharNumber,
        LLreferenceNumber: req.body.LLreferenceNumber,
        Verified: req.body.Verified,
        examId: req.body.examId,
        examPassword: req.body.examPassword,
    };

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_examDetails").insertOne(examCredentials)
                .then(() => {
                    console.log("Exam Credentials  added successfully");
                    res.status(200).json({ message: "Exam Credentials  added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding Fees Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.post('/examNotVerifiedUsers', (req, res) => {
    const examCredentials = {
        aadharNumber: req.body.aadharNumber,
        LLreferenceNumber: req.body.LLreferenceNumber,
        Verified: req.body.Verified,
        purpose: req.body.purpose
    };

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_examNotVerifiedUsers").insertOne(examCredentials)
                .then(() => {
                    console.log("not verified user  added successfully");
                    res.status(200).json({ message: "not verified user  added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding Fees Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});



app.get("/examCredentials", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_examDetails").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

app.get("/examNotVerifiedUsers", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_examNotVerifiedUsers").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});


// for update the LL form

app.put("/updateUserLLForm/:id",(req, res)=>{
    var id = req.params.id;
    const updatedUserData = req.body;
    mongoClient.connect(constring).then((clientObj)=>{
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_LLForm").updateOne({aadharNumber:id},{$set:updatedUserData})
        .then(()=>{
            console.log("LL form Updated Successfully");
            res.end();
        })
    })
});

// for update signature

app.put('/updateSignature/:aadharNumber', upload.single('signatureImage'), (req, res) => {
    var aadharNumber = req.params.aadharNumber;
    const file = req.file;
    const formData = req.body;
    if (file) {
        formData.signature = file.buffer.toString('base64');
    }
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_Uploads").updateOne({ aadharNumber: aadharNumber }, { $set: formData })
            .then(() => {
                console.log("Signature Updated Successfully");
                res.end();
            })
    });
});

// for captured photo update
app.put('/capturedPhotoUpdate/:aadharNumber', upload.single('image'), (req, res) => {
    var aadharNumber = req.params.aadharNumber;
    const file = req.file;
    const data = req.body;

    if (file) {
        data.image = file.buffer.toString('base64');
    }

    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_CapturedPhoto").updateOne({ aadharNumber: aadharNumber }, { $set: data })
            .then(() => {
                console.log("Capture photo Updated Successfully");
                res.end();
            });
    });
});

 
// for exam questions
app.get("/quizQuestions", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_quizQuestions").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});


//exam stauus and uniqueLLId
app.post('/examStatus', (req, res) => {
    const data = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_examStatus").insertOne(data)
                .then(() => {
                    console.log("exam status  added successfully");
                    res.status(200).json({ message: "exam status added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding exam status Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/examStatus", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_examStatus").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

//failed users of ll exam

app.post('/failedUserDetails', (req, res) => {
    const data = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_failedUserDetails").insertOne(data)
                .then(() => {
                    console.log("exam status  added successfully");
                    res.status(200).json({ message: "exam status added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding exam status Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/failedUserDetails", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_failedUserDetails").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});


app.delete("/examNotVerifiedUsers/:aadharNumber/:LLreferenceNumber", (req, res) => {
    const aadharNumber = req.params.aadharNumber;
    const LLreferenceNumber = req.params.LLreferenceNumber;

    // MongoDB connection and deletion
    mongoClient.connect(constring).then((clientObj) => {
        const database = clientObj.db("Driving-License-Db");
        const collection = database.collection("tbl_examNotVerifiedUsers");

        // Assuming a composite key of "aadharNumber" and "LLreferenceNumber" uniquely identifies a user
        collection.deleteOne({ aadharNumber: aadharNumber, LLreferenceNumber: LLreferenceNumber }, (err, result) => {
            if (err) {
                res.status(500).send("Database delete error");
            } else if (result.deletedCount === 0) {
                res.status(404).send("User not found");
            } else {
                res.status(204).end(); // Respond with a 204 status (No Content) for successful deletion
            }

            clientObj.close(); // Close the database connection
        });
    });
});


app.post('/DLSlotBookings', (req, res) => {
    const dlData = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_DLSlotBookings").insertOne(dlData)
                .then(() => {
                    console.log("dl slot added successfully");
                    res.status(200).json({ message: "dl slot added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding exam status Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/DLSlotBookings", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_DLSlotBookings").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

app.post('/DLpaymentData', (req, res) => {
    const DLPaymentData = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_DLFeePayment").insertOne(DLPaymentData)
                .then(() => {
                    console.log("dl payment data added successfully");
                    res.status(200).json({ message: "dl payment data added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding exam status Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/DLpaymentData", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_DLFeePayment").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

//fetch combined of dl slot bookings and dl payment details
app.get("/fetchDLslotANDdlFeeDetails", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");

        database.collection("tbl_DLSlotBookings").aggregate([
            {
                $lookup: {
                    from: "tbl_DLFeePayment",
                    localField: "aadharNumber",
                    foreignField: "aadharNumber",
                    as: "DLslotandDLfeecombinedData"
                }
            },
            {
                $unwind: "$DLslotandDLfeecombinedData"
            },
            {
                $sort: { "DLslotandDLfeecombinedData.timestamp": -1 } // Sort by timestamp in descending order
            },
            {
                $group: {
                    _id: "$_id",
                    aadharNumber: { $first: "$aadharNumber" },
                    slotDate: { $first: "$slotDate" },
                    slotTime: { $first: "$slotTime" },
                    fullName: { $first: "$fullName" },
                    DLSlotReferenceNumber: { $first: "$DLSlotReferenceNumber" },
                    combinedData: { $push: "$DLslotandDLfeecombinedData" }
                }
            }
        ]).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

//dl captured photo
mongoose.connect('mongodb://127.0.0.1:27017/Driving-License-Db', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Create a schema for image uploads
const DLphotoUploadSchema = new mongoose.Schema({
    aadharNumber: String,
  image: Buffer, // Binary image data
},{
    collection: 'tbl_DLCapturedPhoto'
});

const DLcaptureUpload = mongoose.model('DLCaptureUpload', DLphotoUploadSchema);

// Set up multer for handling file uploads
// const PhotoUploadStorage = multer.memoryStorage();
// const photoUpload = multer({ storage: PhotoUploadStorage });

// Handle POST requests to upload an image
app.post('/DLCapturedPhoto', photoUpload.single('image'), async (req, res) => {
    // If multer didn't find a file in the request, it will return an error
    if (req.file) {
        try {
            // Create a new instance of Upload

            const { aadharNumber } = req.body;
            const newUpload = new DLcaptureUpload({
                aadharNumber: aadharNumber, // Store the aadharNumber
                image: req.file.buffer, // Store the binary image data
            });

            // Save the image data to the database
            await newUpload.save();

            res.status(200).json({ message: 'Image uploaded and saved successfully.' });
        } catch (error) {
            res.status(500).json({ error: 'An error occurred while saving the image.' });
        }
    } else {
        res.status(400).json({ error: 'No image file provided' });
    }
});

app.get("/DLCapturedPhoto", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_DLCapturedPhoto").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

app.post('/DLDetails', (req, res) => {
    const dlData = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_DLDetails").insertOne(dlData)
                .then(() => {
                    console.log("dl data added successfully");
                    res.status(200).json({ message: "dl data added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding exam status Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/DLDetails", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_DLDetails").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

app.post('/LLrenewDetails', (req, res) => {
    const llrenewdata = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_LLrenew").insertOne(llrenewdata)
                .then(() => {
                    console.log("LL renew data added successfully");
                    res.status(200).json({ message: "LL renew data added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding  ll renew Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/LLrenewDetails", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_LLrenew").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});

app.post('/DLrenewDetails', (req, res) => {
    const llrenewdata = req.body;

    mongoClient.connect(constring)
        .then(clientObj => {
            const database = clientObj.db('Driving-License-Db');
            database.collection("tbl_DLrenewDetails").insertOne(llrenewdata)
                .then(() => {
                    console.log("DL renew data added successfully");
                    res.status(200).json({ message: "DL renew data added successfully" });
                })
                .catch(err => {
                    console.error("Error Adding  dl renew Data: " + err);
                    res.status(500).json({ error: "An error occurred while storing data." });
                })
                .finally(() => {
                    clientObj.close();
                });
        })
        .catch(err => {
            console.error("Error connecting to the database: " + err);
            res.status(500).json({ error: "An error occurred while connecting to the database." });
        });
});

app.get("/DLrenewDetails", (req, res) => {
    mongoClient.connect(constring).then((clientObj) => {
        var database = clientObj.db("Driving-License-Db");
        database.collection("tbl_DLrenewDetails").find({}).toArray().then((docs) => {
            res.send(docs);
            res.end();
        });
    });
});


app.listen(4000);
console.log(`Server started : http://127.0.0.1:4000`);