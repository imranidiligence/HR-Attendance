const jwt = require("jsonwebtoken");

const authMiddleware = async(req,res,next)=>{
    

  // console.log("req",req)
    if (req.method === "OPTIONS") {
        return next();
      }
    try{

      // console.log("req.headers",req.headers)

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
        

        // console.log("decoded",decoded);
        req.user = decoded;

        next();
    }catch(err){
        return res.status(401).json({message:"Invalid Token"});
    }

}

module.exports = authMiddleware