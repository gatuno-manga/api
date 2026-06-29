import * as mqtt from 'mqtt';

const host = process.env.NANOMQ_HOST || 'localhost';
// Se a variável for 'nanomq' (padrão no docker-compose) mas o script for rodado na máquina local, usa localhost
const actualHost = host === 'nanomq' ? 'localhost' : host;
const port = process.env.NANOMQ_PORT || 1883;

const brokerUrl = `mqtt://${actualHost}:${port}`;
console.log(`Tentando conectar ao broker MQTT em ${brokerUrl}...`);

const client = mqtt.connect(brokerUrl, {
	clientId: `test_client_${Math.random().toString(16).substring(2, 8)}`,
	username: 'internal-system',
	clean: true,
	connectTimeout: 4000,
	reconnectPeriod: 1000,
});

client.on('connect', () => {
	console.log('✅ Conectado ao broker MQTT com sucesso!');

	const testTopic = 'test/gatuno/topic';

	// Subscreve em um tópico
	client.subscribe([testTopic], () => {
		console.log(`✅ Inscrito no tópico: ${testTopic}`);

		// Publica uma mensagem de teste
		const testMessage = {
			message: 'Hello Gatuno',
			timestamp: new Date().toISOString(),
		};

		client.publish(
			testTopic,
			JSON.stringify(testMessage),
			{ qos: 1 },
			(err) => {
				if (err) {
					console.error('❌ Falha ao publicar mensagem:', err);
				} else {
					console.log(
						`✅ Mensagem publicada no tópico ${testTopic}:`,
						testMessage,
					);
				}
			},
		);
	});
});

client.on('message', (topic, payload) => {
	console.log(`📩 Mensagem recebida [${topic}]:`, payload.toString());

	// Encerra a conexão após receber a mensagem de teste
	setTimeout(() => {
		console.log('Desconectando...');
		client.end();
	}, 1000);
});

client.on('error', (error) => {
	console.error('❌ Erro de conexão:', error);
	client.end();
});

client.on('offline', () => {
	console.log('⚠️ Cliente offline. O broker pode estar inacessível.');
});

client.on('reconnect', () => {
	console.log('🔄 Tentando reconectar...');
});
