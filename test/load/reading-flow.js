import { check, group, sleep } from 'k6';
import http from 'k6/http';

export const options = {
	stages: [
		{ duration: '30s', target: 20 }, // Ramp-up: Sobe gradualmente para 20 usuários em 30s
		{ duration: '2m', target: 20 }, // Sustenta 20 usuários lendo ao mesmo tempo por 2 min
		{ duration: '30s', target: 0 }, // Ramp-down: Reduz até 0 usuários
	],
	thresholds: {
		http_req_duration: ['p(95)<1000'], // 95% das requisições devem ocorrer em menos de 1 segundo
		http_req_failed: ['rate<0.05'], // Tolerância de erro inferior a 5%
	},
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api';

export default function () {
	// 1. Listagem de Livros (Simulando usuário abrindo o app e scrollando a página inicial)
	group('1. Browse Books', () => {
		const res = http.get(`${BASE_URL}/books?page=1&limit=20`);

		check(res, {
			'status is 200': (r) => r.status === 200,
		});

		let books = [];
		if (res.status === 200) {
			try {
				const body = JSON.parse(res.body);
				// Extrai os livros dependendo do formato de paginação retornado
				books =
					body.data ||
					body.items ||
					body.edges?.map((e) => e.node) ||
					(Array.isArray(body) ? body : []);
			} catch (e) {}
		}

		sleep(Math.random() * 2 + 1); // Usuário leva 1 a 3 segundos escolhendo um livro

		// Se não encontrou livros na base, aborta esse ciclo
		if (!books || books.length === 0) return;

		// Seleciona um livro aleatório para abrir
		const randomBook = books[Math.floor(Math.random() * books.length)];
		const bookId = randomBook.id;

		// 2. Visualização de Detalhes do Livro (Carrega a página do livro e os capítulos)
		group('2. View Book Details', () => {
			// Requisição para dados do livro
			const bookRes = http.get(`${BASE_URL}/books/${bookId}`);
			check(bookRes, { 'status is 200': (r) => r.status === 200 });

			// Requisição para listar capítulos daquele livro
			const chaptersRes = http.get(
				`${BASE_URL}/books/${bookId}/chapters?limit=50`,
			);
			check(chaptersRes, { 'status is 200': (r) => r.status === 200 });

			sleep(Math.random() * 2 + 1); // Usuário leva 1 a 3 segundos lendo sinopse e escolhendo capítulo

			let chapters = [];
			if (chaptersRes.status === 200) {
				try {
					const chaptersBody = JSON.parse(chaptersRes.body);
					chapters =
						chaptersBody.data ||
						chaptersBody.items ||
						chaptersBody.edges?.map((e) => e.node) ||
						(Array.isArray(chaptersBody) ? chaptersBody : []);
				} catch (e) {}
			}

			if (!chapters || chapters.length === 0) return;

			// Seleciona o primeiro capítulo (ou um aleatório) para ler
			const randomChapter =
				chapters[Math.floor(Math.random() * chapters.length)];
			const chapterId = randomChapter.id;

			// 3. Leitura do Capítulo
			group('3. Read Chapter', () => {
				const chapterRes = http.get(
					`${BASE_URL}/chapters/${chapterId}`,
				);
				check(chapterRes, { 'status is 200': (r) => r.status === 200 });

				// Simula o tempo que o usuário gasta lendo as imagens do capítulo (ex: 5 a 15 segundos)
				sleep(Math.random() * 10 + 5);
			});
		});
	});
}
