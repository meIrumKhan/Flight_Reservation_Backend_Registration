const mongoose = require("mongoose");
const { Schema } = mongoose;
const shortid = require("shortid");

mongoose.connect(
  "mongodb+srv://irumriaz:N1UPpbrYa8Ggthvr@cluster0.ngfpv.mongodb.net/AIRTIK"
);

const locationSchema = new mongoose.Schema({
  city: { type: String, required: true },
  country: { type: String, required: true },
});

const routeSchema = new mongoose.Schema({
  origin: { type: String, required: true },
  destination: { type: String, required: true },
  duration: { type: String, required: true },
  distance: { type: Number, required: true },
});

const airlineSchema = new mongoose.Schema({
  airline: { type: String, required: true },
  code: { type: String, required: true },
  image: {
    data: Buffer,
    contentType: String,
  },
});

const flightSchema = new mongoose.Schema({
  airline: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Airlines",
    required: true,
  },
  route: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Routes",
    required: true,
  },
  flightNumber: { type: String, required: true },
  departureTime: { type: Date, required: true },
  departureDate: { type: Date, required: true },
  total: { type: Number, required: true },
  available: { type: Number, required: true },
  price: { type: Number, required: true },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phno: { type: String, required: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
});


const bookingSchema = new Schema({
  ticketId: {
    type: String,
    required: true,
    default: function () {
      return `TICKET-${shortid.generate().toUpperCase()}`;
    },
  },
  flights: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Flights",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  seats: {
    type: Number,
    required: true,
    min: [1, "At least one seat must be booked."],
  },
  seatNumbers: {
    type: [String],
    required: true,
    validate: {
      validator: function (seatNumbers) {
        return seatNumbers.length === this.seats;
      },
      message: "Number of seat numbers must match the number of seats booked.",
    },
  },
  totalPrice: {
    type: Number,
    required: true,
    min: [0, "Total price must be a positive value."],
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Completed", "Failed"],
    default: "Completed",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-validation hook to validate seat availability and assign seat numbers
bookingSchema.pre("validate", async function (next) {
  try {
    // Skip if not a new booking or seat numbers are already assigned
    if (!this.isNew || this.seatNumbers.length > 0) {
      return next();
    }

    // Fetch the flight details
    const flight = await mongoose.model("Flights").findById(this.flights);


    if (!flight) {
      return next(new Error("Flight not found."));
    }

    // Check if there are enough available seats
    if (flight.available < this.seats) {
      return next(
        new Error(`Not enough available seats. Only ${flight.available} left.`)
      );
    }

    // Get current bookings for this flight
    const currentBookings = await mongoose.model("Booking").find({
      flights: this.flights,
    });

    // Collect all currently booked seat numbers
    const bookedSeatNumbers = currentBookings.flatMap((booking) => booking.seatNumbers);

    // Generate all available seats based on flight total
    const availableSeats = [];
    for (let i = 1; i <= flight.total; i++) {
      const seat = `Seat-${i}`;
      if (!bookedSeatNumbers.includes(seat)) {
        availableSeats.push(seat);
      }
    }

    // Check if there are enough unbooked seats
    if (availableSeats.length < this.seats) {
      return next(
        new Error(
          `Not enough unbooked seats available. Only ${availableSeats.length} unbooked seats left.`
        )
      );
    }

    // Assign seat numbers from available seats
    this.seatNumbers = availableSeats.slice(0, this.seats);

    next();
  } catch (error) {
    console.error("Error in pre-validate hook:", error);
    next(error);
  }
});

bookingSchema.post("save", async function () {
  const flight = await mongoose.model("Flights").findById(this.flights);
  if (flight) {
    flight.available -= this.seats; 
    await flight.save();
  }
});

bookingSchema.post("remove", async function () {
  const flight = await mongoose.model("Flights").findById(this.flights);
  if (flight) {
    flight.available += this.seats; 
    await flight.save();
  }
});


const bookingModel = mongoose.model("Booking", bookingSchema);

const userModel = mongoose.model("Users", userSchema);
const locationModel = mongoose.model("Location", locationSchema);
const routeModel = mongoose.model("Routes", routeSchema);
const airlineModel = mongoose.model("Airlines", airlineSchema);
const flightModel = mongoose.model("Flights", flightSchema);

module.exports = {
  userModel,
  locationModel,
  routeModel,
  airlineModel,
  flightModel,
  bookingModel
};
