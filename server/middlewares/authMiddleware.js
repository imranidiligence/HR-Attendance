const jwt = require("jsonwebtoken");

const authMiddleware = async(req,res,next)=>{
    
    if (req.method === "OPTIONS") {
        return next();
      }
    try{

        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
          ) {
            token = req.headers.authorization.split(" ")[1];
          }


        // console.log("token",token)
        if(!token){
            return res.status(401).json({message:"No Token,Access Denied"})
        }

        const decoded = jwt.verify(token,process.env.JWT_SECRET);
        
        req.user = decoded;

        next();
    }catch(err){
        return res.status(401).json({message:"Invalid Token"});
    }

}

module.exports = authMiddleware