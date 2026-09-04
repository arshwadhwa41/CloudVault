import dotenv from "dotenv";
dotenv.config(); 
import express from "express";
import app from "./app.js";
import env from "./config/env.js";
import connectDatabase from "./config/db.js";

async function startServer(){
    try{
        await connectDatabase();

        app.listen(env.port,()=>{
            console.log(`Server running on http://localhost:${env.port}`);
        });
    }catch(error){
        console.log("Sever startup failed:",error);
        process.exit(1);
    }
}
startServer();