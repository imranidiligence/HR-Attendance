


function processAttendance(rawLogs) {
    const grouped = {};
  
    rawLogs.forEach(log => {
      const empId = log.deviceUserId;
      const time = new Date(log.recordTime);
  
      if (!grouped[empId]) grouped[empId] = [];
      grouped[empId].push(time);
    });
  
    const result = [];
  
    Object.keys(grouped).forEach(empId => {
      const times = grouped[empId].sort((a, b) => a - b);
  
      result.push({
        device_user_id: empId,
        punch_in: times[0],
        punch_out: times[times.length - 1],
        date: times[0].toISOString().split("T")[0]
      });
    });
  
    return result;
  }
  
  module.exports = processAttendance;
  