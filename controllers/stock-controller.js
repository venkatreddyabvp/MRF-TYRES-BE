import Stock from "../models/stock-model.js";
import Sales from "../models/sales-model.js";
import { sendEmail } from "../utils/mailer.js";

export const addStock = async (req, res) => {
  try {
    const {
      date,
      quantity,
      tyreSize,
      SSP,
      totalAmount,
      pricePerUnit,
      location,
    } = req.body;
    const { role } = req.user;

    if (!["owner", "worker"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!location) {
      return res.status(400).json({ message: "Location is required" });
    }

    // Check if there is existing open stock for the current date with the same tyreSize and location
    const existingOpenStock = await Stock.findOne({
      date: new Date(date).toISOString().split("T")[0],
      tyreSize,
      status: "open-stock",
      location,
    });

    if (existingOpenStock) {
      return res.status(400).json({
        message:
          "Open stock already exists for this tyreSize and location. Please update the existing open stock.",
      });
    }

    // Check if there is existing stock with the same tyreSize, location, and previous date
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    let previousStock = await Stock.findOne({
      date: previousDate.toISOString().split("T")[0],
      tyreSize,
      status: "existing-stock",
      location,
    });

    if (previousStock) {
      // Update existing-stock quantity and totalAmount from previous day's open-stock
      previousStock.quantity += quantity;
      previousStock.totalAmount += totalAmount;
      await previousStock.save();

      // Create a new open-stock for the current date based on the previous day's open-stock
      const newOpenStock = new Stock({
        date: new Date(date).toISOString().split("T")[0],
        status: "open-stock",
        quantity: previousStock.quantity,
        tyreSize,
        SSP: previousStock.SSP,
        totalAmount: previousStock.totalAmount,
        pricePerUnit: previousStock.pricePerUnit,
        location,
      });
      await newOpenStock.save();

      // Create a new existing-stock based on the new open-stock and add the new stock
      const newExistingStock = new Stock({
        date: new Date(date).toISOString().split("T")[0],
        status: "existing-stock",
        quantity: previousStock.quantity + quantity,
        tyreSize,
        SSP: previousStock.SSP,
        totalAmount: previousStock.totalAmount + totalAmount,
        pricePerUnit: previousStock.pricePerUnit,
        location,
      });
      await newExistingStock.save();
    } else {
      // If there is no existing-stock for the previous date, create one from previous day's open-stock
      const previousOpenStock = await Stock.findOne({
        date: previousDate.toISOString().split("T")[0],
        tyreSize,
        status: "open-stock",
        location,
      });

      if (previousOpenStock) {
        const newStock = new Stock({
          date: new Date(date).toISOString().split("T")[0],
          status: "open-stock",
          quantity,
          tyreSize,
          SSP,
          totalAmount,
          pricePerUnit,
          location,
        });
        await newStock.save();
      } else {
        // If there is no previous open-stock, create a new open-stock for the current date
        const newStock = new Stock({
          date: new Date(date).toISOString().split("T")[0],
          status: "open-stock",
          quantity,
          tyreSize,
          SSP,
          totalAmount,
          pricePerUnit,
          location,
        });
        await newStock.save();

        // Create a corresponding existing-stock record
        const existingStock = new Stock({
          date: new Date(date).toISOString().split("T")[0],
          status: "existing-stock",
          quantity,
          tyreSize,
          SSP,
          totalAmount,
          pricePerUnit,
          location,
        });
        await existingStock.save();
      }
    }

    res.status(201).json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to update stock", error: err.message });
  }
};

//updating the stock__________________________________________________
export const updateOpenStock = async (req, res) => {
  try {
    const {
      date,
      quantity,
      tyreSize,
      SSP,
      totalAmount,
      pricePerUnit,
      location,
    } = req.body;
    const { role } = req.user;

    if (!["owner", "worker"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Find open-stock record with the same tyreSize and date
    let stock = await Stock.findOne({ date, tyreSize, status: "open-stock" });

    if (!stock) {
      return res
        .status(404)
        .json({ message: "Open stock not found for this tyreSize and date" });
    }

    // Find existing-stock record with the same tyreSize and date
    let existingStock = await Stock.findOne({
      date,
      tyreSize,
      status: "existing-stock",
      location,
    });

    if (!existingStock) {
      // Create a new existing-stock record from open-stock values
      existingStock = new Stock({
        date,
        status: "existing-stock",
        quantity: stock.quantity + quantity,
        tyreSize,
        SSP,
        totalAmount: stock.totalAmount + totalAmount,
        pricePerUnit,
        location,
      });
    } else {
      // Update existing-stock record with new quantity and totalAmount
      existingStock.quantity += quantity;
      existingStock.totalAmount += totalAmount;
    }

    // Save the existing-stock record
    await existingStock.save();

    res.status(200).json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Failed to update stock", error: err.message });
  }
};

//record sale______________________________________
export const recordSale = async (req, res) => {
  try {
    const {
      date,
      quantity,
      customerName,
      phoneNumber,
      comment,
      tyreSize,
      pricePerUnit,
      location,
    } = req.body;
    const { role, id: userId } = req.user;

    // Check if the user has the owner or worker role
    if (!["owner", "worker"].includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Parse the date or use the current date if not provided
    const currentDate = date ? new Date(date) : new Date();

    // Check if there is existing stock for the current date and tyreSize
    let existingStock = await Stock.findOne({
      date: currentDate.toISOString().split("T")[0],
      tyreSize,
      status: "existing-stock",
      location,
    });

    // If there is no existing stock, check for existing stock of the previous day
    if (!existingStock) {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousStock = await Stock.findOne({
        date: previousDate.toISOString().split("T")[0],
        tyreSize,
        status: "existing-stock",
        location,
      });

      if (previousStock) {
        // Create a new existing-stock record from the previous day's stock
        existingStock = new Stock({
          date: currentDate.toISOString().split("T")[0],
          status: "existing-stock",
          quantity: previousStock.quantity,
          tyreSize: previousStock.tyreSize,
          SSP: previousStock.SSP,
          totalAmount: previousStock.totalAmount,
          pricePerUnit: previousStock.pricePerUnit,
          location: previousStock.location,
        });
        await existingStock.save();
      } else {
        // If there is no previous day's stock, check for open stock
        const openStock = await Stock.findOne({
          date: currentDate.toISOString().split("T")[0],
          tyreSize,
          status: "open-stock",
          location,
        });

        if (openStock) {
          // Create a new existing-stock record from the open stock
          existingStock = new Stock({
            date: currentDate.toISOString().split("T")[0],
            status: "existing-stock",
            quantity: openStock.quantity,
            tyreSize: openStock.tyreSize,
            SSP: openStock.SSP,
            totalAmount: openStock.totalAmount,
            pricePerUnit: openStock.pricePerUnit,
            location: openStock.location,
          });
          await existingStock.save();
        } else {
          return res.status(404).json({ message: "Item not found in stock" });
        }
      }
    }

    // Calculate the total amount based on quantity and price per unit
    const totalAmount = quantity * pricePerUnit;

    // Check if the requested quantity is available in existing stock
    if (existingStock.quantity < quantity) {
      return res.status(400).json({ message: "Insufficient stock quantity" });
    }

    // Update the existing-stock record with the new quantity and total amount
    existingStock.quantity -= quantity;
    existingStock.totalAmount -= totalAmount;
    await existingStock.save();

    // Create a new sales record
    const newSale = new Sales({
      date: currentDate.toISOString().split("T")[0],
      quantity,
      totalAmount,
      pricePerUnit,
      customerName,
      phoneNumber,
      comment,
      tyreSize,
      location,
      user: userId,
    });
    await newSale.save();

    // Send email notification with stock details
    const emailOptions = {
      from: "venkatreddyabvp2@gmail.com",
      to: "venkatreddyabvp2@gmail.com",
      subject: "Stock Update Notification",
      text: `Stock updated successfully. Details: Date: ${existingStock.date}, Tyre Size: ${existingStock.tyreSize}, Quantity: ${existingStock.quantity}, Total Amount: ${existingStock.totalAmount}`,
      html: `<p>Stock updated successfully.</p><p>Details:</p><ul><li>Date: ${existingStock.date}</li><li>Tyre Size: ${existingStock.tyreSize}</li><li>Quantity: ${existingStock.quantity}</li><li>Total Amount: ${existingStock.totalAmount}</li></ul>`,
    };
    await sendEmail(emailOptions);

    // Respond with success message
    res.status(201).json({ message: "Stock updated successfully" });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: "Failed to record sales", error: err.message });
  }
};

//get OpenStock_____
export const getOpenStock = async (req, res) => {
  try {
    // Find all "open-stock" records for the current date
    const currentDate = new Date().toISOString().split("T")[0];
    let openStock = await Stock.find({
      date: currentDate,
      status: "open-stock",
    });

    // If there are no open-stock records for the current date, create from previous date "existing-stock"
    if (openStock.length === 0) {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousStock = await Stock.find({
        date: previousDate.toISOString().split("T")[0],
        status: "existing-stock",
        location: req.body.location, // Assuming location is passed in the request body
      });

      if (previousStock.length > 0) {
        // Create new open-stock records from previous existing-stock records
        for (const stock of previousStock) {
          const newStock = new Stock({
            date: currentDate,
            status: "open-stock",
            quantity: stock.quantity,
            tyreSize: stock.tyreSize,
            SSP: stock.SSP,
            totalAmount: stock.totalAmount,
            pricePerUnit: stock.pricePerUnit,
            location: stock.location,
          });
          await newStock.save();
        }

        // Retrieve the newly created open-stock records
        openStock = await Stock.find({
          date: currentDate,
          status: "open-stock",
        });
      } else {
        // If there are no existing-stock records for the previous date and location, return empty array
        openStock = [];
      }
    }

    res.status(200).json({ openStock });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to get open stock" });
  }
};

export const getExistingStock = async (req, res) => {
  try {
    // Find all "existing-stock" records for the current date
    const currentDate = new Date().toISOString().split("T")[0];
    let existingStock = await Stock.find({
      date: currentDate,
      status: "existing-stock",
    });

    // If there is no existing stock for the current date, create from current date "open-stock"
    if (existingStock.length === 0) {
      const openStock = await Stock.find({
        date: currentDate,
        status: "open-stock",
      });

      if (openStock.length > 0) {
        // Create new existing-stock records from current date open-stock records
        for (const stock of openStock) {
          const newStock = new Stock({
            date: currentDate,
            status: "existing-stock",
            quantity: stock.quantity,
            tyreSize: stock.tyreSize,
            SSP: stock.SSP,
            totalAmount: stock.totalAmount,
            pricePerUnit: stock.pricePerUnit,
            location: stock.location,
          });
          await newStock.save();
        }

        // Retrieve the newly created existing-stock records
        existingStock = await Stock.find({
          date: currentDate,
          status: "existing-stock",
        });
      }
    }

    // If there is existing stock from the previous date, create a "closing-stock" record
    if (existingStock.length === 0) {
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousStock = await Stock.find({
        date: previousDate.toISOString().split("T")[0],
        status: "existing-stock",
      });

      if (previousStock.length > 0) {
        // Create a copy of the previous date existing stock and change status to "closing-stock"
        for (const stock of previousStock) {
          const newStock = new Stock({
            date: currentDate,
            status: "closing-stock",
            quantity: stock.quantity,
            tyreSize: stock.tyreSize,
            SSP: stock.SSP,
            totalAmount: stock.totalAmount,
            pricePerUnit: stock.pricePerUnit,
            location: stock.location,
          });
          await newStock.save();
        }
      }
    }

    res.status(200).json({ existingStock });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to get existing stock" });
  }
};

export const getOpenStockDays = async (req, res) => {
  try {
    // Find all "open-stock-day" records
    const openStockDays = await Stock.find({ status: "open-stock-day" });

    res.status(200).json({ openStockDays });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to get open stock days" });
  }
};

export const getSalesRecords = async (req, res) => {
  try {
    // Find all sales records
    const salesRecords = await Sales.find();

    res.status(200).json({ salesRecords });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ message: "Failed to get sales records", error: err.message });
  }
};

// controllers/stockController.js
export const getClosingStock = async (req, res) => {
  try {
    // Find all "existing-stock" records of the previous date
    const currentDate = new Date();
    const previousDate = new Date(currentDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const existingStockPreviousDate = await Stock.find({
      date: previousDate.toISOString().split("T")[0],
      status: "existing-stock",
    });

    // Find all "open-stock" records of the previous date
    const openStockPreviousDate = await Stock.find({
      date: previousDate.toISOString().split("T")[0],
      status: "open-stock",
    });

    // Create new "closing-stock" records from existing-stock and open-stock records of the previous date
    const closingStock = [];
    for (const stock of existingStockPreviousDate) {
      const newStock = new Stock({
        date: currentDate.toISOString().split("T")[0],
        status: "closing-stock",
        quantity: stock.quantity,
        tyreSize: stock.tyreSize,
        SSP: stock.SSP,
        totalAmount: stock.totalAmount,
        pricePerUnit: stock.pricePerUnit,
        location: stock.location,
      });
      await newStock.save();
      closingStock.push(newStock);
    }

    for (const stock of openStockPreviousDate) {
      const newStock = new Stock({
        date: currentDate.toISOString().split("T")[0],
        status: "closing-stock",
        quantity: stock.quantity,
        tyreSize: stock.tyreSize,
        SSP: stock.SSP,
        totalAmount: stock.totalAmount,
        pricePerUnit: stock.pricePerUnit,
        location: stock.location,
      });
      await newStock.save();
      closingStock.push(newStock);
    }

    res.status(200).json({ closingStock });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Failed to get closing stock" });
  }
};
