const { db } = require("../db/connectDB");


exports.getSettings = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM "GlobalSettings"'
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

exports.getSettingByKey = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM "GlobalSettings" WHERE "SettingKey" = $1',
      [req.params.key]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}