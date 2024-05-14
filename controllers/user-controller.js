import User from "../models/user-model.js";

const createUser = async (req, res) => {
  const { username, password, location, role } = req.body;
  try {
    const user = new User({ username, password, location, role });
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
  try {
    const workers = await User.find({ role: "worker" });
    res.status(200).json(workers);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  const { userId } = req.params;
  const { username, password, location, role } = req.body;
  try {
    await User.findByIdAndUpdate(userId, {
      username,
      password,
      location,
      role,
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
