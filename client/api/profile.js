import axios from "axios";

const API_URL = "http://localhost:5000/api/employee/profile"; // your base API url
const token = localStorage.getItem("token"); // or wherever you store it
const axiosConfig = {
  headers: {
    "Content-Type": "application/json", // THIS IS REQUIRED
    Authorization: `Bearer ${token}`,
  },
};


// -------- ORGANIZATION --------
export const getOrganization = () => axios.get(`${API_URL}/organization`, axiosConfig);

export const updateOrganization = (data) =>
  axios.put(`${API_URL}/organization`, data, axiosConfig);

// -------- PERSONAL --------
export const getPersonal = (emp_id) => axios.get(`${API_URL}/personal/${emp_id}`, axiosConfig);

export const addPersonal = (emp_id,data) => axios.post(`${API_URL}/personal/${emp_id}`, data,axiosConfig);

export const updatePersonal = (emp_id, data) =>
  axios.put(`${API_URL}/personal/${emp_id}`, data, axiosConfig);

// -------- EDUCATION --------
export const getEducation = (emp_id) => axios.get(`${API_URL}/education/${emp_id}`, axiosConfig);




export const addEducations = (emp_id, data) =>
  axios.post(`${API_URL}/education/${emp_id}`, data, axiosConfig);


// UPDATE education
export const updateEducation = (emp_id, id, data) =>
    axios.put(`${API_URL}/education/${emp_id}/${id}`, data, axiosConfig);
  
  // 🗑 DELETE education
  export const deleteEducation = (emp_id, id) =>
    axios.delete(`${API_URL}/education/${emp_id}/${id}`, axiosConfig);
  
// -------- EXPERIENCE --------
export const getExperience = (emp_id) => axios.get(`${API_URL}/experience/${emp_id}`, axiosConfig);

// CREATE experience
export const addExperienceses = (emp_id, data) =>
    axios.post(`${API_URL}/experience/${emp_id}`, data, axiosConfig);
  
  // UPDATE experience
  export const updateExperience = (emp_id, id, data) =>
    axios.put(`${API_URL}/experience/${emp_id}/${id}`, data, axiosConfig);

// DELETE experience
export const deleteExperience = (emp_id, id, data) =>
  axios.delete(`${API_URL}/experience/${emp_id}/${id}`, data, axiosConfig);

  

// Contact
export const getContact = (emp_id) => axios.get(`${API_URL}/contact/${emp_id}`, axiosConfig);



export const updateContact = (emp_id, contact) =>
    axios.put(`${API_URL}/contact/${emp_id}`, contact, axiosConfig);
  
  


// -------- BANK --------
export const getBank = (emp_id) => axios.get(`${API_URL}/bank/${emp_id}`, axiosConfig);


export const addBank = (emp_id,data) => axios.post(`${API_URL}/bank/${emp_id}`, data,axiosConfig);


export const updateBank = (emp_id,data) => axios.put(`${API_URL}/bank/${emp_id}`, data,axiosConfig);

export const uploadBankDoc = (emp_id, formData) =>
  axios.post(`${API_URL}/bank/doc/${emp_id}`, formData, {
    ...axiosConfig,
    headers: {
      ...axiosConfig.headers,
      "Content-Type": "multipart/form-data",
    },
  });

