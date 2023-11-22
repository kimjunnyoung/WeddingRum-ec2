const UserModel = require('../database/models/userModel')
const crypto = require('crypto');
const redis = require('redis');
require('dotenv').config();
const { makeRefreshToken, makeAccessToken } = require('../utils/token');

const redisClient = redis.createClient({
	password : process.env.REDIS_PASSWORD,
		socket : {
			host : process.env.REDIS_HOST,
			port : process.env.REDIS_PORT
	},
	legacyMode: true,
})
redisClient.connect();


// const redisClient = redis.createClient({
// 	password: '0B7FGs7Q2qistIUJvlmHRikCkR9v1TUG',
// 	socket: {
// 			host: 'redis-14791.c246.us-east-1-4.ec2.cloud.redislabs.com',
// 			port: 14791
// 	},
// 	legacyMode: true,
// });



class UserService{
	//유효성 검사 이메일 겹치는지 등등
	static async addUser({name, id, pwd, phone, birth, gender, companionName, companionPhone}){
		console.log("id: ",id);

		//crypto.randomBytes(128): 길이가 128인 임의의 바이트 시퀀스를 생성
		//.toString('base64'): 임의의 바이트를 base64로 인코딩된 문자열로 변환
		const salt = crypto.randomBytes(128).toString('base64'); 

		// crypto.createHash('sha512'): SHA-512 해시 개체를 생성
		//.update(pwd + salt): 비밀번호( pwd)와 솔트를 연결하여 해시를 업데이트
		//.digest('hex'): 16진수 형식으로 최종 해시를 생성
		const hashPassword = crypto
			.createHash('sha512')
			.update(pwd + salt)
			.digest('hex'); 

		const newUser = {name, id, pwd: hashPassword, salt, phone, birth, gender, companionName, companionPhone}
		
		const createNewUser = await UserModel.createUser({newUser});
		return createNewUser
	}

	static async loginUser({id, pwd}){
		// console.log("id: ",id);
		// console.log("pwd: ",pwd);

		const user = await UserModel.findOneUserId({ id });
		if (!user) {
			const errorMessage = "해당 id는 가입 내역이 없습니다. 다시 한 번 확인해 주세요.";
			return errorMessage;
		}

		// Combine entered password with stored salt
		const combinedPassword = pwd + user.salt;

		// Hash the combined password and salt
		const hashedPassword = crypto
			.createHash('sha512')
			.update(combinedPassword)
			.digest('hex');

		// Compare the generated hash with the stored hashed password
		if (hashedPassword === user.pwd) {
			console.log('Login successful!');
			const accessToken = makeAccessToken({id: user.id});
			const refreshToken = makeRefreshToken();

			// userId를 키값으로 refresh token을 redis server에 저장
			
			await redisClient.set(user.id, refreshToken);
			// await redisClient.get(user.id, (err, value) => {
			// 	console.log("redis.value: ", value); 
			// });
			redisClient.get(refreshToken, (err, val) => {
				console.log("* : ", val);
			});
			const name = user.name; 
			const id = user.id;			
			const newUser = {name, id, accessToken, refreshToken};

			return newUser
		}else {
			console.log('Invalid login credentials.');
		}

	}

}
module.exports = UserService;