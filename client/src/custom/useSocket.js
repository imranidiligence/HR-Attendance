// import { useEffect, useState } from 'react';
// import { io } from 'socket.io-client';
// import { toast } from 'react-hot-toast'; // Optional: for nice popups

// const useSocket = (empId) => {
//   const [socket, setSocket] = useState(null);

//   useEffect(() => {
//     if (!empId) return;

//           const newSocket = io("http://localhost:5000", {
//             query: { empId },
//             transports: ["websocket"],
//           });


//     setSocket(newSocket);

//     // 2. Listen for New Leave Requests (For Managers/Admins)
//     newSocket.on("NEW_LEAVE_REQUEST", (data) => {
//       console.log("New Request Received:", data);
//       toast.success(data.message, { duration: 5000 });
//       // Logic to refresh your "Pending Approvals" table
//     });

//     // 3. Listen for Status Updates (For Employees)
//     newSocket.on("LEAVE_STATUS_UPDATE", (data) => {
//       if (data.status === 'approved') {
//         toast.success(data.message);
//       } else {
//         toast.error(data.message);
//       }
//       // Logic to refresh "My Leave History"
//     });

//     // Cleanup on logout/unmount
//     return () => newSocket.close();
//   }, [empId]);

//   return socket;
// };

// export default useSocket;




import { useEffect } from "react";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";

const useSocket = (empId, refreshFn) => {
  useEffect(() => {
    if (!empId) return;

    const socket = io("http://localhost:5000", {
      query: { empId },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      // console.log(" Connected:", socket.id);
    });

    //  NEW LEAVE REQUEST
    socket.on("NEW_LEAVE_REQUEST", (data) => {
      // console.log(" New Leave:", data);

      toast.success(data.message);

      // refresh table instantly
      if (refreshFn) refreshFn();
    });

    return () => socket.disconnect();
  }, [empId, refreshFn]);
};

export default useSocket;