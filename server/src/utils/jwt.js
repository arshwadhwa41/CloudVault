import jwt from "jsonwebtoken";
import env from "../config/env.js";

export function createToken(userId){
    if(!env.jwtSecret){
        throw new Error("JWT_SECRET is not configured");
    }

    return jwt.sign(
        {
            sub:userId.toString(),
        },
        env.jwtSecret,
        {
            expiresIn:env.jwtExpiresIn,
        },
    );
}

export function verifyToken(token){
    if(!env.jwtSecret){
        throw new Error("JWT_SECRET is not configured");
    }
    return jwt.verify(token,env.jwtSecret);
}