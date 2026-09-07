const {
    syncEmployeeLeaveQuota
} = require("../services/LeaveQuotaService");

exports.syncLeaveQuota = async (req, res) => {
    try {

        const result = await syncEmployeeLeaveQuota();

        return res.status(200).json({
            success: true,
            message: "Employee leave quota synchronized successfully",
            data: result
        });

    } catch (error) {

        console.error(
            "[LEAVE QUOTA API ERROR]",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to synchronize employee leave quota",
            error: error.message
        });
    }
};