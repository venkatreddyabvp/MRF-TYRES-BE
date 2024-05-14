// controllers/user-controller.js
import User from "../models/user-model.js";

const createUser = async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can create users." });
  }

  const { username, password, location } = req.body;
  try {
    const user = new User({ username, password, location, isAdmin: false });
    await user.save();
    res.status(201).json({ message: "User created successfully." });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password." });
    }
    res.status(200).json({ message: "Login successful.", user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getAllWorkers = async (req, res) => {
  if (!req.user.isAdmin) {
    return res
      .status(403)
      .json({ message: "Only admins can access this resource." });
  }

  try {
    const workers = await User.find({ isAdmin: false });
    res.status(200).json(workers);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can update users." });
  }

  const { userId } = req.params;
  const { username, password, location } = req.body;
  try {
    await User.findByIdAndUpdate(userId, { username, password, location });
    res.status(200).json({ message: "User updated successfully." });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: "Only admins can delete users." });
  }

  const { userId } = req.params;
  try {
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: "User deleted successfully." });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export { createUser, login, getAllWorkers, updateUser, deleteUser };
