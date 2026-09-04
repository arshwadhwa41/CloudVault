// Import Express so we can create a router.
import express from "express";

// Create a separate router for health-related endpoints.
const healthRouter=express.Router();

// Respond to GET /api/health
healthRouter.get("/",(req,res)=>{
    // Send a consistent success response to the frontend.
    res.status(200).json({
        success:true,
        message:"Digital Asset API is running well",
        timestamp:new Date().toISOString(),
    });
});

// Export the router so app.js can register it
export default healthRouter;