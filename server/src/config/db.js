import mongoose from "mongoose";

async function connectDatabase(){
    if(!process.env.MONGO_URI){
        throw new error("MONGO_URI is not working");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.info("Mongo DB connected successfully");
}
export default connectDatabase;