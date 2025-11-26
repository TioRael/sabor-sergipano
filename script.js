// --- CONFIGURAÇÃO E ESTADO ---
let estabelecimentos = [];
let maps = { desktop: null, mobile: null };
let markersLayers = { desktop: null, mobile: null };
let filtros = {
    texto: '',
    culinaria: [],
    preco: [],
    abertoAgora: false
};
// Variável para armazenar o ID do restaurante sugerido no dia
let sugestaoDoDiaId = null; 

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    await carregarDados();
    initMaps(); // Inicializa os mapas vazios
    // Pequeno delay para garantir que o container do mapa tenha tamanho
    setTimeout(() => {
        renderApp();
        renderSugestaoDoDia(); // Chama a nova função de sugestão após carregar tudo
    }, 100); 
    setupEventListeners();
});

// --- CORE: DADOS ---
async function carregarDados() {
    try {
        const resp = await fetch('estabelecimentos.json');
        estabelecimentos = await resp.json();
        atualizarStatusAberto();
        // Gerar o ID da sugestão do dia imediatamente após carregar
        sugestaoDoDiaId = gerarSugestaoDiaria(estabelecimentos); 

    } catch (error) {
        console.error("Erro ao carregar:", error);
        document.getElementById('listaEstabelecimentos').innerHTML = 
            `<p class="col-span-full text-center text-red-500 bg-red-50 p-4 rounded-xl">Ops! Não foi possível carregar os roteiros. Verifique sua conexão.</p>`;
    }
}

function atualizarStatusAberto() {
    const agora = new Date();
    const diasSemana = ['dom','seg','ter','qua','qui','sex','sab'];
    const diaHoje = diasSemana[agora.getDay()];
    const minAtual = agora.getHours() * 60 + agora.getMinutes();

    estabelecimentos.forEach(est => {
        let estaAberto = false;
        if (est.horario_funcionamento) {
            // Mapeia o horário de funcionamento para o dia de hoje
            const horarios = Object.entries(est.horario_funcionamento)
                                 .filter(([key]) => key.includes(diaHoje) || key.includes('todos'))
                                 .map(([, value]) => value);

            for (const horario of horarios) {
                if (horario) {
                    const [abre, fecha] = horario.split('-');
                    if(abre && fecha) {
                        const [hA, mA] = abre.split(':').map(Number);
                        const [hF, mF] = fecha.split(':').map(Number);
                        const minAbre = hA * 60 + mA;
                        let minFecha = hF * 60 + mF;
                        
                        // Lógica de virada de dia (se fechar depois da meia noite)
                        if (minFecha < minAbre) minFecha += 24 * 60; 

                        // Checa se o horário atual está dentro do intervalo
                        if (minAtual >= minAbre && minAtual <= minFecha) {
                            estaAberto = true;
                            break;
                        }
                    }
                }
            }
        }
        est.abertoAgora = estaAberto;
    });
}

// --- CORE: ROTEIRO DO DIA ---
// Gera uma sugestão fixa baseada na data para que não mude durante o dia
function gerarSugestaoDiaria(lista) {
    if (lista.length === 0) return null;
    
    // Pega o número do dia do ano (hash simples)
    const hoje = new Date();
    const start = new Date(hoje.getFullYear(), 0, 0);
    const diff = hoje - start;
    const umDia = 1000 * 60 * 60 * 24;
    const diaDoAno = Math.floor(diff / umDia);
    
    // Usa o dia do ano para indexar (garante a mesma sugestão o dia inteiro)
    const indice = diaDoAno % lista.length; 
    return lista[indice].id;
}

function renderSugestaoDoDia() {
    const container = document.getElementById('sugestaoRestaurante');
    const sugestao = estabelecimentos.find(e => e.id === sugestaoDoDiaId);

    if (!sugestao) {
        container.innerHTML = `<p class="text-sm text-gray-500">Nenhuma sugestão disponível hoje.</p>`;
        return;
    }

    // Encontra o prato principal para destacar
    const pratoDestaque = sugestao.pratos_destaque && sugestao.pratos_destaque.length > 0 
        ? sugestao.pratos_destaque[0] 
        : { nome: "Prato da Casa", descricao: "Verifique o cardápio completo!" };

    container.innerHTML = `
        <a href="detalhes.html?id=${sugestao.id}" class="block group">
            <div class="h-24 overflow-hidden rounded-xl mb-3">
                <img src="${sugestao.imagens[0]}" alt="${sugestao.nome}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            </div>
            <h4 class="font-bold text-lg text-gray-900 dark:text-white group-hover:text-laranja-600 transition">${sugestao.nome}</h4>
            <p class="text-sm text-gray-500 mb-2">${sugestao.tipo_culinaria} • ${sugestao.cidade}</p>
            
            <div class="mt-3 p-3 bg-laranja-50/50 dark:bg-laranja-900/20 rounded-lg border border-laranja-100 dark:border-laranja-900">
                <p class="text-xs font-semibold text-laranja-700 dark:text-laranja-400">Prato em Destaque:</p>
                <p class="font-medium text-sm text-gray-800 dark:text-white">${pratoDestaque.nome}</p>
            </div>

            <div class="mt-4 text-center">
                <span class="inline-block px-4 py-2 bg-laranja-600 text-white text-sm font-bold rounded-full hover:bg-laranja-700 transition">Conhecer o Local →</span>
            </div>
        </a>
    `;
}

// --- RENDERIZAÇÃO ---
function renderApp() {
    const filtrados = estabelecimentos.filter(aplicarFiltrosLogic);
    
    // Atualiza contadores e UI
    const countEl = document.getElementById('resultsCount');
    if(countEl) countEl.innerText = `${filtrados.length} locais encontrados`;
    
    renderLista(filtrados);
    renderMarcadores(filtrados); 
    renderChipsCulinaria();
}

function renderLista(lista) {
    const container = document.getElementById('listaEstabelecimentos');
    
    if (lista.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-20 text-center opacity-70">
                <div class="text-6xl mb-4">🌵</div>
                <h3 class="text-xl font-bold text-gray-800 dark:text-white">Eita, achamos nada!</h3>
                <p class="text-gray-500">Tenta buscar por outra coisa ou limpa os filtros.</p>
            </div>`;
        return;
    }

    container.innerHTML = lista.map((est, index) => {
        const delay = Math.min(index * 50, 500); // Cap delay
        const statusClass = est.abertoAgora ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-500 bg-red-50 border-red-200';
        const statusText = est.abertoAgora ? 'Aberto Agora' : 'Fechado';

        return `
        <article class="glass-card bg-white/60 dark:bg-gray-800/60 rounded-2xl overflow-hidden group hover:-translate-y-2 hover:shadow-2xl transition-all duration-300 animate-fade-up border-0" style="animation-delay: ${delay}ms">
            <a href="detalhes.html?id=${est.id}" class="block h-full flex flex-col">
                <div class="relative h-56 overflow-hidden">
                    <img src="${est.imagens[0]}" alt="${est.nome}" loading="lazy" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                    
                    <div class="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border shadow-sm ${statusClass}">
                        ${statusText}
                    </div>
                    
                    <div class="absolute bottom-3 left-3 text-white">
                         <span class="text-xs font-bold bg-laranja-600 px-2 py-0.5 rounded text-white mb-1 inline-block">${est.tipo_culinaria}</span>
                    </div>
                </div>
                
                <div class="p-5 flex flex-col flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white leading-tight group-hover:text-laranja-600 transition-colors">${est.nome}</h3>
                    </div>
                    
                    <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2 flex-1">${est.descricao}</p>
                    
                    <div class="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                        <span class="text-sm font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            📍 ${est.cidade}
                        </span>
                        <span class="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                            ${est.faixa_preco}
                        </span>
                    </div>
                </div>
            </a>
        </article>
        `;
    }).join('');
}

function renderChipsCulinaria() {
    const container = document.getElementById('quickCulinariaFilter');
    const todas = [...new Set(estabelecimentos.map(e => e.tipo_culinaria))].sort();
    
    // Botão "Todos"
    let html = `
        <button onclick="toggleCulinaria('')" 
        class="whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border ${filtros.culinaria.length === 0 ? 'bg-gray-900 text-white dark:bg-white dark:text-black border-transparent shadow-lg' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-laranja-400'}">
            Todas
        </button>
    `;

    html += todas.map(tipo => {
        const ativo = filtros.culinaria.includes(tipo);
        const classeAtiva = 'bg-laranja-500 text-white border-laranja-500 shadow-lg shadow-laranja-500/30 transform scale-105';
        const classeInativa = 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-laranja-400 hover:text-laranja-600';
        
        return `<button onclick="toggleCulinaria('${tipo}')" 
                class="whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 border capitalize ${ativo ? classeAtiva : classeInativa}">
                ${tipo}
            </button>`;
    }).join('');

    container.innerHTML = html;
}

// --- MAPAS (Desktop & Mobile) ---
function initMaps() {
    const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const tileAttr = '&copy; OpenStreetMap';
    // Centraliza em Sergipe (coordenada genérica de Itabaiana/Aracaju)
    const initialView = [-10.8, -37.4]; 

    // Mapa Desktop
    if(document.getElementById('desktopMap')) {
        maps.desktop = L.map('desktopMap', { zoomControl: true }).setView(initialView, 9);
        L.tileLayer(tileUrl, { attribution: tileAttr }).addTo(maps.desktop);
        markersLayers.desktop = L.layerGroup().addTo(maps.desktop);
    }

    // Mapa Mobile
    maps.mobile = L.map('mobileMap', { zoomControl: false }).setView(initialView, 9);
    L.tileLayer(tileUrl, { attribution: tileAttr }).addTo(maps.mobile);
    markersLayers.mobile = L.layerGroup().addTo(maps.mobile);
}

function renderMarcadores(lista) {
    // Cria ícone personalizado (Pino)
    const createIcon = (ativo) => L.divIcon({
        className: 'bg-transparent',
        html: `<div class="relative group cursor-pointer">
                 <div class="w-8 h-8 ${ativo ? 'bg-green-500' : 'bg-red-500'} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white transform transition-transform group-hover:scale-125">
                    ${ativo ? '🍽️' : '🔒'}
                 </div>
                 <div class="w-2 h-2 bg-black/20 rounded-full mx-auto mt-1 filter blur-[1px]"></div>
               </div>`,
        iconSize: [32, 42],
        iconAnchor: [16, 40],
        popupAnchor: [0, -40]
    });

    ['desktop', 'mobile'].forEach(view => {
        if (!maps[view] || !markersLayers[view]) return;
        
        markersLayers[view].clearLayers();
        const bounds = L.latLngBounds();
        let temPontos = false;

        lista.forEach(est => {
            if(!est.latitude || !est.longitude) return;

            const marker = L.marker([est.latitude, est.longitude], {
                icon: createIcon(est.abertoAgora)
            });
            
            // Popup Customizado HTML
            const popupContent = `
                <div class="overflow-hidden rounded-xl">
                    <div class="h-24 w-full relative">
                         <img src="${est.imagens[0]}" class="w-full h-full object-cover">
                         <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2">
                            <span class="text-white font-bold text-sm">${est.nome}</span>
                         </div>
                    </div>
                    <div class="p-3 bg-white dark:bg-gray-800">
                        <p class="text-xs text-gray-500 mb-2">${est.tipo_culinaria} • ${est.cidade}</p>
                        <a href="detalhes.html?id=${est.id}" class="block w-full text-center bg-laranja-500 text-white text-xs font-bold py-2 rounded-lg hover:bg-laranja-600 transition">Ver Detalhes</a>
                    </div>
                </div>
            `;
            
            marker.bindPopup(popupContent, { minWidth: 200, maxWidth: 200 });
            marker.addTo(markersLayers[view]);
            bounds.extend([est.latitude, est.longitude]);
            temPontos = true;
        });

        // Ajustar zoom para mostrar todos os pinos
        if(temPontos) {
            maps[view].fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        }
    });
}

// --- FILTROS LÓGICA ---
function aplicarFiltrosLogic(est) {
    // Adicionei busca por cidade na lógica de filtro de texto
    const textMatch = !filtros.texto || 
                      est.nome.toLowerCase().includes(filtros.texto.toLowerCase()) || 
                      est.tipo_culinaria.toLowerCase().includes(filtros.texto.toLowerCase()) ||
                      est.cidade.toLowerCase().includes(filtros.texto.toLowerCase());

    const culinariaMatch = filtros.culinaria.length === 0 || filtros.culinaria.includes(est.tipo_culinaria);
    const precoMatch = filtros.preco.length === 0 || filtros.preco.includes(est.faixa_preco);
    const abertoMatch = !filtros.abertoAgora || est.abertoAgora;

    return textMatch && culinariaMatch && precoMatch && abertoMatch;
}

// --- INTERATIVIDADE ---
window.toggleCulinaria = (tipo) => {
    if (tipo === '') filtros.culinaria = [];
    else filtros.culinaria = [tipo]; // Seleção única para simplificar
    renderApp();
};

function setupEventListeners() {
    // Busca Texto
    document.getElementById('searchInput').addEventListener('input', (e) => {
        filtros.texto = e.target.value;
        renderApp();
    });

    // Chips de Preço
    document.querySelectorAll('.filter-chip-price').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.target.dataset.preco;
            e.target.classList.toggle('bg-laranja-100');
            e.target.classList.toggle('text-laranja-700');
            e.target.classList.toggle('border-laranja-500');
            e.target.classList.toggle('border-gray-200'); // remove borda cinza
            
            if (filtros.preco.includes(val)) filtros.preco = filtros.preco.filter(p => p !== val);
            else filtros.preco.push(val);
        });
    });

    // Filtro Aberto Agora
    document.getElementById('abertoAgora').addEventListener('change', (e) => {
        filtros.abertoAgora = e.target.checked;
    });

    // Aplicar/Limpar
    document.getElementById('applyFilters').addEventListener('click', () => {
        renderApp();
        toggleFilterPanel(false);
    });
    
    document.getElementById('clearFilters').addEventListener('click', () => {
        filtros = { texto: '', culinaria: [], preco: [], abertoAgora: false };
        document.getElementById('searchInput').value = '';
        document.getElementById('abertoAgora').checked = false;
        document.querySelectorAll('.filter-chip-price').forEach(b => {
            b.classList.remove('bg-laranja-100', 'text-laranja-700', 'border-laranja-500');
            b.classList.add('border-gray-200');
        });
        renderApp();
    });

    // Toggle Painéis
    const toggleFilterPanel = (show) => {
        const panel = document.getElementById('filterPanel');
        const overlay = document.getElementById('filterOverlay');
        if (show) {
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
            panel.classList.remove('translate-x-full');
        } else {
            overlay.classList.add('opacity-0');
            panel.classList.add('translate-x-full');
            setTimeout(() => overlay.classList.add('hidden'), 300);
        }
    };

    document.getElementById('openFilters').addEventListener('click', () => toggleFilterPanel(true));
    document.getElementById('mobileFilterBtn').addEventListener('click', () => toggleFilterPanel(true));
    document.getElementById('closeFilters').addEventListener('click', () => toggleFilterPanel(false));
    document.getElementById('filterOverlay').addEventListener('click', () => toggleFilterPanel(false));

    // Mobile Map
    const mapModal = document.getElementById('mobileMapModal');
    document.getElementById('toggleMobileMap').addEventListener('click', () => {
        mapModal.classList.remove('translate-y-full');
        // Importante: Invalida o tamanho para o mapa carregar corretamente no modal
        setTimeout(() => maps.mobile.invalidateSize(), 300); 
    });
    document.getElementById('closeMobileMap').addEventListener('click', () => {
        mapModal.classList.add('translate-y-full');
    });

    // Dark Mode
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeIcons();
    });
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    updateThemeIcons();
}

function updateThemeIcons() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelector('.sun').classList.toggle('hidden', isDark);
    document.querySelector('.moon').classList.toggle('hidden', !isDark);
}