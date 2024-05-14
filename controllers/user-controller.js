import User from "../models/user-model.js";
import jwt from "jsonwebtoken";
const createUser = async (req, res) => {
  const { username, password, location, role, phoneNumber } = req.body;
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User with this phone number already exists." });
    }

    // Create new user
    const user = new User({ username, password, location, role, phoneNumber });
    await user.save();
    res.status(201).json({ message: "User created successfully." });
  } catch (err) {
    console.error(err); // Log the error for debugging
    res
      .status(400)
      .json({ message: "An error occurred while creating the user." });
  }
};

const login = async (req, res) => {
  const { phoneNumber, password } = req.body;
  try {
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid phoneNumber or password." });
    }

    // Verify password
    const isPasswordValid = await user.isValidPassword(password);
    if (!isPasswordValid) {
      return res
        .status(401)
        .json({ message: "Invalid phoneNumber or password." });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }, // Token expires in 1 hour
    );

    res.status(200).json({ message: "Login successful.", user, token });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAllWorkers = async (req, res) => {
  try {
    const workers = await User.find({ role: "worker" });
    res.status(200).json(workers);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { username, password, location, role, phoneNumber } = req.body;
  try {
    await User.findByIdAndUpdate(userId, {
      username,
      password,
      location,
      role,
      phoneNumber,
    });
    res.status(200).json({ message: "User updated successfully." });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  const { userId } = req.params;
  try {
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: "User deleted successfully." });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export { createUser, login, getAllWorkers, updateUser, deleteUser };
