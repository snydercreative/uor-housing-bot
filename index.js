const Discord = require('discord.js');
const client = new Discord.Client();
const AWS = require('aws-sdk')
const axios = require('axios')

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async msg => {
	if (msg.author.bot) return;

	switch (msg.content.trim()) {
		case '!drops':
			getHouses(msg, 'drops.json', '**Dropped Houses**\n\n')
			break;
		case '!new':
			getHouses(msg, 'new-houses.json', '**Newly-Placed Houses**\n\n')
			break
		default:
			return
	}
})

function getHouses(msg, myKey, title) {
	const s3 = new AWS.S3({
		signatureVersion: 'v4', 
		region: 'us-east-2',
		accessKeyId: process.env.ACCESS_KEY_ID, 
		secretAccessKey: process.env.SECRET_ACCESS_KEY
	})
	
	const myBucket = 'uor-housing'
	const signedUrlExpireSeconds = 600
	const headConfig = {
		Bucket: myBucket,
		Key: myKey,
	} 
	
	const signedConfig = {
		Bucket: myBucket,
		Key: myKey,
		Expires: signedUrlExpireSeconds,
	} 
		
	const url = s3.getSignedUrl('getObject', signedConfig)

	s3.headObject(headConfig, async (err, res) => {
		if (err) {
			console.log(err)
			return 
		} 
		
		try {
			const file = await axios.default.get(url)

			const cleaned = file.data.toString()
				.replace(/\:/g, '')
				.replace(/\+/g, '')
				.replace(/1$/, '')
				.split("1,")

			const embed = new Discord.MessageEmbed()

			const houseTypes = []

			if (cleaned.length && cleaned[0].trim() !== '') {
				embed.addField('Status', `${cleaned.length} houses listed.`, false)

				const processed = cleaned.map((d, idx) => {
					const a = d.split(/\s/)
					const l = a.length
					const y = a[l-2]
					const x = a[l-3]
					const desc = a.slice(0, l-3).join(' ').trim()
	
					houseTypes.push(desc)

					return {
						desc,
						link: `${idx+1}. [${x}, ${y}](https://tinyurl.com/w99p8xb?coords=${x},${y})`
					}
				})			

				const houseTypeSet = new Set(houseTypes)

				houseTypeSet.forEach(ht => {
					const links = processed.map(p => { 
						if (p.desc === ht) {
							return p.link
						}
					})

					embed.addField(ht, links, true)
				})
			} else 
				embed.addField('Status', 'No records today, folks.', false)
				
			const suffix = `Last updated ${res.LastModified.toLocaleDateString()} @ ${res.LastModified.toLocaleTimeString()}.`
	
			embed.setDescription(title)
			embed.setFooter(suffix)
	
			try {
				await msg.channel.send(embed)
			} catch (ex) {
				embed.fields = [embed.fields[0]]
				embed.addField('Error! There are probably too many houses listed.')
				await msg.channel.send(embed)
			}

		} catch (ex) {
			console.log(ex)
			await msg.channel.send('Something went wrong...')
		}
	})
}

client.login(process.env.DISCORD_KEY)