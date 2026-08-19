import React, { useState, useEffect } from 'react';
import axios from 'axios';
import api from '../../api/axiosInstance';
import toast from 'react-hot-toast';

// const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : '/api';


// console.log("API_BASE",API_BASE); // http://localhost:5000/api
import { FaPencilAlt, FaCheck, FaTimes, FaPlus, FaUpload } from 'react-icons/fa';
import { MdDelete } from 'react-icons/md';
// Assuming 'api' is imported from your config

const CronManager = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(null);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [empEmail, setEmpEmail] = useState([]);
  const [email, setEmail] = useState("");

  // States for Table Editing
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(null);

  // --- Helpers ---
  const formatToAMPM = (time) => {
    if (!time) return "--:--";
    let [hours, minutes] = time.split(':');
    let ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    return `${hours}:${minutes.padStart(2, '0')} ${ampm}`;
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/update-schedule`);
      const formatted = data.map(s => {
        const parts = s.cron_pattern.split(' ');
        return {
          ...s,
          // Cron: "min hour * * *" -> HH:mm
          timeValue: `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`
        };
      });
      setSchedules(formatted);
    } catch (err) {
      toast.error("Failed to load schedules");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      const { data } = await api.get(`/update-schedule/emails`);
      setEmpEmail(data);
    } catch (err) {
      console.error("Failed to fetch emails", err);
    }
  };

  useEffect(() => {
    fetchSchedules();
    fetchEmails();
  }, []);

  // --- Table Actions ---
  const startEdit = (slot, index) => {
    setEditingIndex(index);
    setDraft({ ...slot });
  };

  const addNewSlot = () => {
    if (editingIndex !== null) return toast.error("Please save current changes first");
    const newSlot = { slot_name: "", timeValue: "09:00", is_enabled: true, isNew: true };
    setSchedules([...schedules, newSlot]);
    setEditingIndex(schedules.length);
    setDraft(newSlot);
  };

 const handleSave = async (index) => {
  if (!draft.slot_name.trim()) return toast.error("Slot name is required");

  // Get the actual Database ID from the schedule item
  const scheduleId = schedules[index].id; 
  const isNew = schedules[index].isNew; 

  // console.log("schedules",schedules)
  // console.log("scheduleId",scheduleId)

  const [hour, minute] = draft.timeValue.split(':');
  const payload = {
    slot_name: draft.slot_name,
    hour: parseInt(hour, 10),
    minute: parseInt(minute, 10),
    status: draft.is_enabled,
  };

  try {
    if (isNew) {
      await api.post(`/update-schedule`, payload);
    } else {
      // Use scheduleId here, NOT index
      await api.put(`/update-schedule/${scheduleId}`, payload);
    }

    // Refresh local state
    const newSchedules = [...schedules];
    newSchedules[index] = { ...draft, isNew: false };
    setSchedules(newSchedules);
    setEditingIndex(null);
    toast.success("Saved successfully");
  } catch (err) {
    toast.error(err.response?.data?.error || "Error saving");
  }
};

  const handleDeleteSchedule = async (slot, index) => {
    if (window.confirm(`Are you sure you want to delete ${slot.slot_name}?`)) {
      try {
        // If your backend doesn't have a specific delete, you might just disable it
        // Or if you have a delete endpoint:
        await api.delete(`/update-schedule/${slot.cron_pattern}`);
        setSchedules(schedules.filter((_, i) => i !== index));
        toast.success("Schedule deleted");
      } catch (err) {
        toast.error("Delete failed");
      }
    }
  };

  // --- Email Actions ---
  const handleAddEmail = async () => {
    if (!email || !email.includes('@')) return toast.error("Enter a valid email");
    try {
      await api.post(`/update-schedule/add-email`, { email });
      fetchEmails(); // Refresh to get the ID from DB
      setEmail("");
      toast.success("Email added");
    } catch (err) {
      toast.error("Failed to add email");
    }
  };

  const handleDeleteEmail = async (id) => {
    try {
      await api.delete(`/update-schedule/emails/${id}`);
      setEmpEmail(empEmail.filter(item => item.id !== id));
      toast.success("Email removed");
    } catch (err) {
      toast.error("Failed to delete email");
    }
  };

  if (loading) return <div className="p-10 text-center">Loading Schedules...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 text-gray-700">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-[#212e7d]">Report Scheduler</h1>
        <button onClick={fetchSchedules} className="bg-[#212e7d] text-white px-4 py-2 rounded-md text-sm">Refresh</button>
      </div>

      {/* Email Recipients Card */}
      <div className="bg-white border rounded-lg shadow-sm p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Email Recipients</h3>
        <div className="flex gap-3 mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter recipient email"
            className="flex-1 border rounded-md px-3 py-2 text-sm"
          />
          <button onClick={handleAddEmail} className="bg-[#212e7d] text-white px-5 py-2 rounded-md text-sm">Add</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {empEmail.map((item) => (
            <div key={item.id} className="flex items-center gap-2 bg-gray-100 border px-3 py-1 rounded-full text-sm">
              {item.email}
              <button onClick={() => handleDeleteEmail(item.id)} className="text-red-500 font-bold">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Settings Table */}
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4 bg-gray-50 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Schedule Settings</h3>
          <div className="p-4 bg-gray-50 border-t">
            <button onClick={addNewSlot} className="bg-[#212e7d] text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 ">
              <FaPlus size={12} /> Add More Scheduler
            </button>
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Slot Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 ">Time (am/pm)</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {schedules.map((slot, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                {editingIndex === index ? (
                  <>
                    <td className="px-6 py-4">
                      <select
                        className="border rounded px-2 py-1 text-sm w-full outline-none focus:ring-1 focus:ring-blue-400 bg-white cursor-pointer"
                        value={draft.slot_name}
                        onChange={(e) => setDraft({ ...draft, slot_name: e.target.value })}
                      >
                        <option value="" disabled>Select a Slot</option>
                        <option value="Morning ">Morning </option>
                        <option value="Afternoon ">Afternoon </option>
                        <option value="Night ">Night </option>
                        {/* <option value="General Shift">General Shift</option> */}
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="time"
                        className="border rounded px-2 py-1 text-sm"
                        value={draft.timeValue}
                        onChange={(e) => setDraft({ ...draft, timeValue: e.target.value })}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={draft.is_enabled}
                        onChange={(e) => setDraft({ ...draft, is_enabled: e.target.value === "true" })}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-3">
                        <button onClick={() => handleSave(index)} className="text-green-600 hover:scale-110 transition-transform">
                          <FaCheck size={18} />
                        </button>
                        <button onClick={() => { setEditingIndex(null); if (slot.isNew) fetchSchedules(); }} className="text-red-700">
                          <FaTimes size={18} />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 capitalize">{slot.slot_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatToAMPM(slot.timeValue)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${slot.is_enabled ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                        {slot.is_enabled ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-4">
                        <button onClick={() => startEdit(slot, index)} className="text-blue-500"><FaPencilAlt size={14} /></button>
                        <button onClick={() => handleDeleteSchedule(slot, index)} className="text-red-500"><MdDelete size={18} /></button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
};

export default CronManager;
