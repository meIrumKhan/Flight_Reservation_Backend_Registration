const express = require("express");
const server = express();
const mongoose = require("mongoose");
const { userModel, locationModel, routeModel, airlineModel, flightModel, bookingModel } = require("./models/store");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const PORT = process.env.PORT || 8000;

server.use(express.static("public"));



server.use(
  cors({
    origin: ["http://localhost:3000", "https://fyp-frontend-roan.vercel.app"], 
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    // allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// server.options('*', cors());

server.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", "true");
  next();
});

server.use(express.json());
server.use(express.urlencoded({ extended: true }));
server.use(cookieParser());
server.use(bodyParser.urlencoded({ extended: true }));

// middleware

const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.json({ token: false });
    }
    jwt.verify(token, "STORESOLUTION", (err, decoded) => {
      if (err) {
        return res.json({ token: false });
      }
      req.user = decoded;
      next();
    });
  } catch (e) {
    console.log(e.message);
  }
};

server.get("/backendtest", (req, res) => {
  try {
    res.json({ message: "Test route working!" });
  } catch (e) {
    console.log(e.message);
  }
});


// Admin Dadhboad\
server.get("/admindashboard", authMiddleware, async (req, res) => {
  try {
    const totalFlights = await flightModel.countDocuments();
    const totalBookings = await bookingModel.countDocuments();
    const totalAirlines = await airlineModel.countDocuments();
    const totalLocations = await locationModel.countDocuments();
    
    res.json({
      success: true,
      message: "Dashboard data fetched successfully.",
      stats: {
        totalFlights,
        totalBookings,
        totalAirlines,
        totalLocations,
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error.message);
    res.json({
      success: false,
      message: "Error fetching dashboard data.",
      error: error.message,
    });
  }
});



// Booking

server.post("/addbooking", authMiddleware, async (req, res) => {
  try {
    const { flights, seats } = req.body;
    const userId = req.user.userId; 

    if (!flights || !seats) {
      return res.json({
        message: "Flight and number of seats are required.",
        success: false,
      });
    }

    const flightDetails = await flightModel.findById(flights);
    if (!flightDetails) {
      return res.json({
        message: "Flight not found.",
        success: false,
      });
    }

    if (flightDetails.available < seats) {
      return res.json({
        message: `Only ${flightDetails.available} seats are available.`,
        success: false,
      });
    }

    const totalPrice = seats * flightDetails.price;

   
    const newBooking = new bookingModel({
      flights,
      user: userId,
      seats,
      totalPrice,
    });

    await newBooking.save();

    
    return res.json({
      message: "Booking created successfully.",
      success: true,
      booking: newBooking,
    });
  } catch (error) {
    console.error("Error adding booking:", error);
    return res.json({
      message: "Server error. Please try again later.",
      success: false,
    });
  }
});

server.get("/getuserbooking", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const bookings = await bookingModel
      .find({ user: userId })
      .populate({
        path: "flights",
        populate: {
          path: "route",
          select: "departureTime destination",
        },
      })
      .select("-__v -updatedAt"); 
    res.json({
      success: true,
      message: "Fetched all bookings successfully.",
      bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error.message);
    res.json({
      success: false,
      message: "Error fetching bookings.",
      error: error.message,
    });
  }
});



server.get("/getbookings", authMiddleware, async (req, res) => {
  try {
    const bookings = await bookingModel
      .find()
      .populate({
        path: "flights",
        populate: {
          path: "route",
          select: "departureTime destination",
        },
      })
      .populate({
        path: "user", // Assuming bookings include user details
        select: "name email",
      })
      .select("-__v -updatedAt");

    res.json({
      success: true,
      message: "Fetched all bookings successfully.",
      bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error.message);
    res.json({
      success: false,
      message: "Error fetching bookings.",
      error: error.message,
    });
  }
});

server.post("/deletebooking", authMiddleware, async (req, res) => {
  const { ticketId } = req.body;

  try {
    const isAdmin = req.user.isAdmin; 
    if (!isAdmin) {
      return res.json({
        message: "Only admin can delete booking.",
        success: false,
      });
    }

    const deleteBooking = await bookingModel.findOneAndDelete({ ticketId: ticketId });
    if (!deleteBooking) {
      return res.json({
        message: "Booking not found.",
        success: false,
      });
    }

    return res.json({
      message: "Booking deleted successfully.",
      success: true,
      ticketId,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});




// Flights



server.get("/addflights", async (req, res) => {
  try {
    
    const routes = await routeModel.find()
    const airlines = await airlineModel.find()

      
    res.json({
      success: true,
      message: "Fetched all flights successfully",
      routes,
      airlines
    });
  } catch (error) {
    console.error("Error fetching flights:", error.message);
    res.json({
      success: false,
      message: "Error fetching flights",
      error: error.message,
    });
  }
});


server.post("/addflight", authMiddleware, async (req, res) => {
  try {
    const {
      airline,
      route,
      flightNumber,
      departureTime,
      departureDate,
      total,
      price,
    } = req.body;

    
    if (
      !airline ||
      !route ||
      !flightNumber ||
      !departureTime ||
      !departureDate ||
      !total ||
      !price
    ) {
      return res.json({ message: "All fields are required.", success: false });
    }

    const routeDetails = await routeModel.findById(route);
    if (!routeDetails) {
      return res.json({ message: "Route not found.", success: false });
    }

    const { origin, destination } = routeDetails;

    const departureDateTime = new Date(
      `${departureDate}T${departureTime}`
    );

    if (isNaN(departureDateTime)) {
      return res.json({ message: "Invalid departure date or time.", success: false });
    }

    const timeClash = await flightModel.findOne({
      route,
      departureDate: departureDate, 
      "departureTime": {
        $gte: new Date(departureDateTime.getTime() - 60 * 60 * 1000), 
        $lte: new Date(departureDateTime.getTime() + 60 * 60 * 1000),
      },
    });

    if (timeClash) {
      return res.json({
        message: `A flight is already scheduled between ${origin} and ${destination} within 1 hour of the selected time.`,
        success: false,
      });
    }

    
    const newFlight = new flightModel({
      airline,
      route,
      flightNumber,
      departureTime: departureDateTime,
      departureDate,
      total,
      available: total, 
      price,
    });

    
    await newFlight.save();

    res.json({
      message: "Flight added successfully.",
      success: true,
      flight: newFlight,
    });
  } catch (error) {
    console.error("Error adding flight:", error);
    res.json({ message: "Server error.", success: false });
  }
});


server.post("/deleteflight", authMiddleware, async (req, res) => {
  const { ID } = req.body;

  try {

    const associatedBooing = await bookingModel.findOne({ flights: ID });
    if (associatedBooing) {
      return res.json({
        message: "Flight cannot be deleted as it is associated with a booking.",
        success: false,
      });
    }

    const isAdmin = req.user.isAdmin; 
    if (!isAdmin) {
      return res.json({
        message: "Only admin can delete flight.",
        success: false,
      });
    }


    const deleteLoc = await flightModel.findByIdAndDelete(ID);
    if (!deleteLoc) {
      return res.json({
        message: "Flight not found.",
        success: false,
      });
    }

    return res.json({
      message: "Flight deleted successfully.",
      success: true,
      ID,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});


server.get("/getallflights", async (req, res) => {
  try {
    
    const flights = await flightModel
      .find()
      .populate("airline") 
      .populate("route") 
      .exec();

    res.json({
      success: true,
      message: "Fetched all flights successfully",
      flights: flights,
    });
  } catch (error) {
    console.error("Error fetching flights:", error.message);
    res.json({
      success: false,
      message: "Error fetching flights",
      error: error.message,
    });
  }
});

server.post("/editflights", authMiddleware, async (req, res) => {
  try {
    const {
      _id, 
      airline,
      route,
      flightNumber,
      departureDate,
      departureTime,
      total,
      price,
    } = req.body;
  
   
    if (
      !_id ||
      !airline ||
      !route ||
      !flightNumber ||
      !departureDate ||
      !departureTime ||
      !total ||
      !price
    ) {
      return res.json({ message: "All fields are required.", success: false });
    }

    
    const flight = await flightModel.findById(_id);
    if (!flight) {
      return res.json({ message: "Flight not found.", success: false });
    }

    
    const routeDetails = await routeModel.findById(route);
    if (!routeDetails) {
      return res.json({ message: "Route not found.", success: false });
    }

    const { origin, destination } = routeDetails;

  
    const departureDateTime = new Date(`${departureDate}T${departureTime}`);
    if (isNaN(departureDateTime)) {
      return res.json({
        message: "Invalid departure date or time.",
        success: false,
      });
    }

    
    const timeClash = await flightModel.findOne({
      _id: { $ne: _id }, 
      route,
      departureDate,
      departureTime: {
        $gte: new Date(departureDateTime.getTime() - 60 * 60 * 1000), 
        $lte: new Date(departureDateTime.getTime() + 60 * 60 * 1000), 
      },
    });

    if (timeClash) {
      return res.json({
        message: `A flight is already scheduled between ${origin} and ${destination} within 1 hour of the selected time.`,
        success: false,
      });
    }

    
    flight.airline = airline;
    flight.route = route;
    flight.flightNumber = flightNumber;
    flight.departureDate = departureDate;
    flight.departureTime = departureDateTime;
    flight.total = total;
    flight.available = total; 
    flight.price = price;


    await flight.save();

    res.json({
      message: "Flight updated successfully.",
      success: true,
      flight,
    });
  } catch (error) {
    console.error("Error updating flight:", error);
    res.json({ message: "Server error.", success: false });
  }
});


// Airlines





server.post(
  "/addairline",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const { airline, code } =
        req.body;
      const imageFile = req.file;

      const existingAirline = await airlineModel.findOne({ airline: airline.trim() });
      const existingCode = await airlineModel.findOne({ code: code.trim() });


      if (existingAirline) {
        return res.json({
          message: "Airline with this name already exists",
          success: false,
        });
      }

      if (existingCode) {
        return res.json({
          message: "Airline Code already exists",
          success: false,
        });
      }

      const newAirline = new airlineModel({
        airline: airline.trim(),
        code: code.toUpperCase().trim(),
      });

      if (newAirline) {
        newAirline.image = {
          data: imageFile.buffer,
          contentType: imageFile.mimetype,
        };
      }

      await newAirline.save();

      return res.json({
        message: "Airline added successfully",
        success: true,
       
      });
    } catch (error) {
      res.json({ message: error.message, success: false });
    }
  }
);



server.get("/getallairlines", authMiddleware, async (req, res) => {
  try {
    const airlines = await airlineModel.find();

    return res.json({
      airlines,
      
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});


server.post("/deleteairlines", authMiddleware, async (req, res) => {
  const { ID } = req.body;

  try {

    const associatedAirline = await flightModel.findOne({ airline : ID });
    if (associatedAirline) {
      return res.json({
        message: "Airline cannot be deleted as it is associated with a flight.",
        success: false,
      });
    }

    const deleteLoc = await airlineModel.findByIdAndDelete(ID);
    if (!deleteLoc) {
      return res.json({
        message: "Airline not found.",
        success: false,
      });
    }

    return res.json({
      message: "Airline deleted successfully.",
      success: true,
      ID,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

server.post(
  "/editairline",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const {
        airline, code,
        id,
      } = req.body;
      const imageFile = req.file;

      if (!airline) {
        return res.json({ message: "Airline name is required" });
      }

      const existingAirline = await airlineModel.findById(id);
      if (!existingAirline) {
        return res.json({ message: "Airline not found", success: false });
      }

      existingAirline.airline = airline.trim();
      existingAirline.code = code.trim().toUpperCase();

      if (imageFile) {
        existingAirline.image = {
          data: imageFile.buffer,
          contentType: imageFile.mimetype,
        };
      } else if (existingImageData && existingImageContentType) {
        existingAirline.image = {
          data: Buffer.from(JSON.parse(existingImageData)),
          contentType: existingImageContentType,
        };
      }

      await existingAirline.save();

     

      return res.json({
        message: "Airline updated successfully",
        success: true,
        
      });
    } catch (e) {
      res.json({ message: e.message, success: false });
    }
  }
);

// FlightRoutes

server.post("/addflightroute", authMiddleware, async (req, res) => {
  try {
    const {  
      origin,
      destination,
      duration,
      distance 
    } = req.body;

    const existingRoute = await routeModel.findOne({
      origin: origin.trim(),
      destination: destination.trim(),
    });

    if (existingRoute) {
      return res.json({
        message: "Route with this origin and destination already exists",
        success: false,
      });
    }

    const newRoute = new routeModel({
      origin: origin.trim(),
      destination: destination.trim(),
      duration,
      distance,
    });

    await newRoute.save();

    return res.json({
      message: "Route added successfully",
      success: true,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

server.get("/getallroutes", authMiddleware, async (req, res) => {
  try {
    const routes = await routeModel.find();

    return res.json({
      routes,
      
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

server.post(
  "/editflightroute",
  authMiddleware,
  async (req, res) => {
    try {
      const {  
        origin,
        destination,
        duration,
        distance,
        _id
      } = req.body;

      const routetoUpdate = await routeModel.findById(_id);

      routetoUpdate.origin = origin.trim();
      routetoUpdate.destination = destination.trim();
      routetoUpdate.duration = duration.trim();
      routetoUpdate.distance = distance

      await routetoUpdate.save();

      return res.json({
        message: "Route updated successfully",
        success: true,
      });
    } catch (e) {
      res.json({ message: e.message, success: false });
    }
  }
);

server.post("/deleteflightroute", authMiddleware, async (req, res) => {
  const { ID } = req.body;

  try {

    const associatedFlight = await flightModel.findOne({ route: ID });
    if (associatedFlight) {
      return res.json({
        message: "Route cannot be deleted as it is associated with a flight.",
        success: false,
      });
    }


    const deleteLoc = await routeModel.findByIdAndDelete(ID);
    if (!deleteLoc) {
      return res.json({
        message: "Route not found.",
        success: false,
      });
    }

    return res.json({
      message: "Route deleted successfully.",
      success: true,
      ID,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

// locations

server.post("/addlocation", authMiddleware, async (req, res) => {
  try {
    const { city, country } = req.body;

    const existingCity = await locationModel.findOne({ city: city.trim() });

    if (existingCity) {
      return res.json({
        message: "City with this name already exists ",
        success: false,
      });
    }

    const newLocation = new locationModel({
      city: city.trim(),
      country: country.trim(),
    });

    await newLocation.save();

    return res.json({
      message: "Location added successfully",
      success: true,
      location: newLocation,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

server.get("/getalllocations", authMiddleware, async (req, res) => {
  try {
    const locations = await locationModel.find();

    return res.json({
      locations,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});


server.post("/deletelocation", authMiddleware, async (req, res) => {
  const { ID } = req.body;

  try {
    const deleteLoc = await locationModel.findByIdAndDelete(ID);
    if (!deleteLoc) {
      return res.json({
        message: "Location not found.",
        success: false,
      });
    }

    return res.json({
      message: "Location deleted successfully.",
      success: true,
      ID,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});


server.post("/updatelocation", authMiddleware, async (req, res) => {
  try {
    const { city, country, _id } = req.body;

    const existingLocation = await locationModel.findById(_id);
    if (!existingLocation) {
      return res.json({ message: "location not found", success: false });
    }

    const existingCity = await locationModel.findOne({ city: city.trim() });

    if (existingCity) {
      return res.json({
        message: "City with this name already exists",
        success: false,
      });
    }

    existingLocation.city = city.trim();
    existingLocation.country = country.trim();

    await existingLocation.save();

    return res.json({
      message: "Location updated successfully",
      success: true,
    });
  } catch (e) {
    res.json({ message: e.message, success: false });
  }
});

// Users

server.post("/adduser", async (req, res) => {
  const { name, password, email, phno, isAdmin } = req.body;
  try {
    const exsistingEmail = await userModel.findOne({
      email,
    });

    if (exsistingEmail) {
      return res.json({
        message: "This email is already registerd",
      });
    }

    const existingPhno = await userModel.findOne({ phno });
    if (existingPhno) {
      return res.json({
        message: "This phone number is already in use",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      name,
      password: hashedPassword,
      email,
      phno,
      isAdmin: isAdmin ? isAdmin : false,
    });

    await newUser.save();

    return res.json({
      message: "User added successfuly",
      success: true,
      user: newUser,
    });
  } catch (error) {
    res.json({ message: error.message });
  }
});

server.get("/getallusers", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId; 
    const users = await userModel.find({ _id: { $ne: userId } });
    return res.json({
      users,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

server.post("/deleteuser", authMiddleware, async (req, res) => {
  const { ID } = req.body;

  try {

    const associatedBooing = await bookingModel.findOne({ user: ID });
    if (associatedBooing) {
      return res.json({
        message: "User cannot be deleted as it is associated with a booking.",
        success: false,
      });
    }

    const deleteUser = await userModel.findByIdAndDelete(ID);
    if (!deleteUser) {
      return res.json({
        message: "User not found.",
        success: false,
      });
    }

    return res.json({
      message: "User deleted successfully.",
      success: true,
      ID,
    });
  } catch (error) {
    res.json({ message: error.message, success: false });
  }
});

// Signup

server.post("/signup", async (req, res) => {
  const { name, password, email, phno, isAdmin } = req.body;
  try {
    const exsistingEmail = await userModel.findOne({
      email,
    });

    if (exsistingEmail) {
      return res.json({
        message: "This email is already registerd",
      });
    }

    const existingPhno = await userModel.findOne({ phno });
    if (existingPhno) {
      return res.json({
        message: "This phone number is already in use",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new userModel({
      name,
      password: hashedPassword,
      email,
      phno,
      isAdmin: isAdmin ? isAdmin : false,
    });

    await newUser.save();

    return res.json({
      message: "sign in successfuly",
      success: true,
      user: newUser,
    });
  } catch (error) {
    res.json({ message: error.message });
  }
});

server.get("/check-auth", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await userModel.findById(userId);

    return res.json({
      login: true,
      user,
      success: true,
    });
  } catch (e) {
    console.log(e.message);
  }
});

server.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email: email });
    if (!user) {
      return res.json({ message: "User not found.", login: false });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (validPassword) {
      const token = jwt.sign(
        {
          userId: user._id,
          isAdmin: user.isAdmin,
        },
        "STORESOLUTION"
        // { expiresIn: "1h" }
      );

      // res.cookie("token", token);

       const cookiesCredentials = {
         httpOnly: true,
         // secure: process.env.NODE_ENV === 'production',
         secure: true,
         sameSite: "None",
         path: "/",
         maxAge: 3600000,
       };

       res.cookie("token", token, cookiesCredentials);

      return res.json({
        user,
        login: true,
        success: true,
      });
    } else {
      return res.json({ message: "Invalid password.", login: false });
    }
  } catch (error) {
    console.error(error);
  }
});

server.get("/logout", authMiddleware, (req, resp) => {
  try {
     resp.clearCookie("token", {
       httpOnly: true,
       secure: true,
       sameSite: "None",
       path: "/",
       maxAge: 0,
     });

    // resp.cookie("token", "");
    resp.json({ logout: true });
  } catch (e) {
    console.log(e.message);
  }
});

server.get("/", (req, resp) => {
  try {

    return resp.json({ message: "Group - Members: Irum Rian, Ammar Sajjad , Muhammad Haseeb - Project: AirTik ( ADVANCED AIR (Reservation-system)) " });

    

  } catch (e) {
    console.log(e.message);
  }
});




server.listen(PORT, () => {
  try {

    console.log(`Server running on port ${PORT}`);
  } catch (e) {
    console.log(e.message);
  }
});
