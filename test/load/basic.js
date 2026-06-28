import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
	stages: [
		{ duration: '10s', target: 10 }, // Ramp-up: sobe para 10 usuários virtuais em 10s
		{ duration: '30s', target: 10 }, // Mantém 10 usuários por 30s
		{ duration: '10s', target: 0 }, // Ramp-down: desce para 0 usuários em 10s
	],
	thresholds: {
		http_req_duration: ['p(95)<500'], // 95% das requisições devem ser menores que 500ms
		http_req_failed: ['rate<0.01'], // Taxa de falha deve ser menor que 1%
	},
};

export default function () {
	// A URL pode ser sobrescrita passando a variável de ambiente: k6 run -e API_URL=http://... test/load/basic.js
	const url = __ENV.API_URL || 'http://localhost:3000/api';

	const res = http.get(url);

	check(res, {
		'status is 200': (r) => r.status === 200,
	});

	sleep(1);
}
