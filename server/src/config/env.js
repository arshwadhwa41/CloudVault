// this file loads environment variables in one central place so configuration is not scattered throughout the application

// load values from the .env file into process.env
import "dotenv/config";

// convert the port from text into a number
const port = Number(process.env.PORT || 5000);

// define all server configuration in one object
const env = {
  port,
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
};

// export configuration so other files can use it.
export default env;