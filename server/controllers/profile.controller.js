

exports.getOrganizationInfo = async(req,res)=>{

    try {
     
            const {
              organizationName,
              organizationCode,
              industryType,
              address,
              city,
              state,
              country,
              isactive
            } = req.body;
        
            if (!organizationName || !organizationCode || !industryType || !address || !city || !state) {
              return res.status(400).json({ message: "All fields required" });
            }
        
            const { rows } = await db.query(
              `
              INSERT INTO organizations 
                (organization_name, organization_code, industry_type, address, city, state, country, is_active)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
              RETURNING organization_name, organization_code, industry_type, address, city, state, country, is_active
              `,
              [organizationName, organizationCode, industryType, address, city, state, country || null, isactive || true]
            );
        
            res.status(201).json({
              message: "Organization created successfully",
              organization: rows[0]
            });
        
         } catch (error) {
        console.log(error);
        req.status(500).json({message:"Internal Server Error"});
    }
}