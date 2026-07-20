#!/bin/bash
# _tools-check.sh — Verificação e instalação de ferramentas
# Deve ser "sourced" pelos scripts que precisam dele:
#   source "$(dirname "$0")/_tools-check.sh"
#
# Expõe as funções:
#   detect_package_manager   → imprime o nome do PM detectado ou "unknown"
#   ensure_tools <tool...>   → verifica e tenta instalar; sai com erro se falhar
#   rsync_with_fallback      → wrapper: usa rsync do host ou via Docker Alpine
#   extract_zst_with_fallback → wrapper: extrai .tar.zst via host ou Docker Alpine

# ============================================
# Detecção de package manager
# ============================================

detect_package_manager() {
    if command -v apk  >/dev/null 2>&1; then echo "apk";    return; fi
    if command -v apt-get >/dev/null 2>&1; then echo "apt";  return; fi
    if command -v dnf  >/dev/null 2>&1; then echo "dnf";    return; fi
    if command -v yum  >/dev/null 2>&1; then echo "yum";    return; fi
    if command -v pacman >/dev/null 2>&1; then echo "pacman"; return; fi
    if command -v zypper >/dev/null 2>&1; then echo "zypper"; return; fi
    echo "unknown"
}

# Mapeamento de pacotes por ferramenta e package manager
# Uso: _pkg_name <pm> <tool>
_pkg_name() {
    local pm="$1"
    local tool="$2"
    case "${pm}:${tool}" in
        # rsync
        apk:rsync)    echo "rsync" ;;
        apt:rsync)    echo "rsync" ;;
        dnf:rsync)    echo "rsync" ;;
        yum:rsync)    echo "rsync" ;;
        pacman:rsync) echo "rsync" ;;
        zypper:rsync) echo "rsync" ;;
        # zstd
        apk:zstd)     echo "zstd" ;;
        apt:zstd)     echo "zstd" ;;
        dnf:zstd)     echo "zstd" ;;
        yum:zstd)     echo "zstd libzstd" ;;
        pacman:zstd)  echo "zstd" ;;
        zypper:zstd)  echo "zstd" ;;
        # sha256sum (parte do coreutils; raramente precisa instalar)
        apk:sha256sum)    echo "coreutils" ;;
        apt:sha256sum)    echo "coreutils" ;;
        dnf:sha256sum)    echo "coreutils" ;;
        yum:sha256sum)    echo "coreutils" ;;
        pacman:sha256sum) echo "coreutils" ;;
        zypper:sha256sum) echo "coreutils" ;;
        # tar
        apk:tar)    echo "tar" ;;
        apt:tar)    echo "tar" ;;
        dnf:tar)    echo "tar" ;;
        yum:tar)    echo "tar" ;;
        pacman:tar) echo "tar" ;;
        zypper:tar) echo "tar" ;;
        *) echo "$tool" ;;  # fallback: mesmo nome
    esac
}

# Instala um pacote usando o package manager detectado
_install_pkg() {
    local pm="$1"
    local pkg="$2"
    local sudo_cmd=""

    # Usar sudo se não for root
    if [ "$(id -u)" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then
            sudo_cmd="sudo"
        else
            return 1  # sem sudo e sem root
        fi
    fi

    case "$pm" in
        apk)    $sudo_cmd apk add --no-cache $pkg >/dev/null 2>&1 ;;
        apt)    $sudo_cmd apt-get install -y -qq $pkg >/dev/null 2>&1 ;;
        dnf)    $sudo_cmd dnf install -y -q $pkg >/dev/null 2>&1 ;;
        yum)    $sudo_cmd yum install -y -q $pkg >/dev/null 2>&1 ;;
        pacman) $sudo_cmd pacman -S --noconfirm --quiet $pkg >/dev/null 2>&1 ;;
        zypper) $sudo_cmd zypper install -y -q $pkg >/dev/null 2>&1 ;;
        *)      return 1 ;;
    esac
}

# ============================================
# Verificação e instalação de ferramentas
# ============================================

# Verifica se Docker está disponível (usado como fallback)
_has_docker() {
    command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

# ensure_tools <tool1> [tool2] ...
# Verifica cada ferramenta; tenta instalar se faltar; aborta se não conseguir.
# Preenche a variável global TOOLS_USE_DOCKER=true se Docker for necessário como fallback.
TOOLS_USE_DOCKER=false

ensure_tools() {
    local pm
    pm=$(detect_package_manager)
    local missing=()

    # Verificar quais ferramentas estão faltando
    for tool in "$@"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing+=("$tool")
        fi
    done

    if [ ${#missing[@]} -eq 0 ]; then
        return 0
    fi

    echo "⚙️  Ferramentas necessárias não encontradas: ${missing[*]}"

    # Separar ferramentas que têm fallback Docker das que não têm
    local need_install=()
    local docker_replaceable=()

    for tool in "${missing[@]}"; do
        case "$tool" in
            rsync|zstd) docker_replaceable+=("$tool") ;;
            *)          need_install+=("$tool") ;;  # tar, sha256sum, find etc — sem fallback Docker fácil
        esac
    done

    # Tentar instalar as que não têm fallback Docker
    for tool in "${need_install[@]}"; do
        echo -n "   Instalando ${tool}..."
        if [ "$pm" = "unknown" ]; then
            echo " ❌ (package manager não detectado)"
            echo "❌ Instale manualmente: ${tool}"
            exit 1
        fi
        local pkg
        pkg=$(_pkg_name "$pm" "$tool")
        if _install_pkg "$pm" "$pkg"; then
            echo " ✅"
        else
            echo " ❌"
            echo "❌ Falha ao instalar '${tool}'. Tente manualmente:"
            _print_install_hint "$pm" "$pkg"
            exit 1
        fi
    done

    # Tentar instalar rsync/zstd; se falhar, usar Docker como fallback
    for tool in "${docker_replaceable[@]}"; do
        echo -n "   Instalando ${tool}..."
        local installed=false

        if [ "$pm" != "unknown" ]; then
            local pkg
            pkg=$(_pkg_name "$pm" "$tool")
            if _install_pkg "$pm" "$pkg"; then
                echo " ✅"
                installed=true
            fi
        fi

        if [ "$installed" = false ]; then
            echo " ❌ (sem permissão ou PM desconhecido)"
            if _has_docker; then
                echo "   ↳ Usando Docker Alpine como fallback para '${tool}' ✅"
                TOOLS_USE_DOCKER=true
            else
                echo "❌ Nem '${tool}' nem Docker disponíveis."
                echo "   Instale uma das opções:"
                _print_install_hint "$pm" "$tool"
                echo "   Ou instale Docker: https://docs.docker.com/engine/install/"
                exit 1
            fi
        fi
    done
}

_print_install_hint() {
    local pm="$1"
    local pkg="$2"
    case "$pm" in
        apk)    echo "     sudo apk add ${pkg}" ;;
        apt)    echo "     sudo apt-get install -y ${pkg}" ;;
        dnf)    echo "     sudo dnf install -y ${pkg}" ;;
        yum)    echo "     sudo yum install -y ${pkg}" ;;
        pacman) echo "     sudo pacman -S ${pkg}" ;;
        zypper) echo "     sudo zypper install ${pkg}" ;;
        *)      echo "     Instale '${pkg}' manualmente para seu sistema" ;;
    esac
}

# ============================================
# Wrappers com fallback Docker
# ============================================

# rsync_with_fallback <rsync_opts_array...>
# Usa rsync do host se disponível, senão usa Docker Alpine.
# IMPORTANTE: --link-dest funciona via bind mount porque os hardlinks
# são criados no filesystem do host (o container acessa via bind mount).
rsync_with_fallback() {
    if command -v rsync >/dev/null 2>&1; then
        rsync "$@"
        return
    fi

    # Fallback: extrair src, dest e link-dest dos args para montar volumes Docker
    # Esta função recebe os mesmos args do rsync
    local args=("$@")
    local src="" dest="" link_dest="" flags=()

    for arg in "${args[@]}"; do
        if [[ "$arg" == --link-dest=* ]]; then
            link_dest="${arg#--link-dest=}"
        elif [[ "$arg" == --link-dest ]]; then
            : # próximo arg é o valor — tratado abaixo
        elif [[ "$arg" == -* ]]; then
            flags+=("$arg")
        elif [ -z "$src" ]; then
            src="$arg"
        else
            dest="$arg"
        fi
    done

    local docker_args=(
        "docker" "run" "--rm"
        "-v" "${src%/}:/mnt/src"
        "-v" "${dest%/}:/mnt/dest"
    )
    local rsync_cmd="apk add --no-cache rsync >/dev/null 2>&1 && rsync ${flags[*]}"

    if [ -n "$link_dest" ]; then
        docker_args+=("-v" "${link_dest%/}:/mnt/linkdest")
        rsync_cmd+=" --link-dest=/mnt/linkdest"
    fi

    rsync_cmd+=" /mnt/src/ /mnt/dest/"
    docker_args+=("alpine" "sh" "-c" "$rsync_cmd")

    "${docker_args[@]}"
}

# extract_zst_with_fallback <arquivo.tar.zst> <destino/>
# Extrai um .tar.zst usando zstd+tar do host, ou Docker Alpine como fallback.
extract_zst_with_fallback() {
    local archive="$1"
    local dest_dir="$2"

    mkdir -p "$dest_dir"

    if command -v zstd >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
        tar --use-compress-program=zstd -xf "$archive" -C "$dest_dir"
        return
    fi

    # Fallback Docker
    local abs_archive
    abs_archive=$(realpath "$archive")
    local abs_dest
    abs_dest=$(realpath "$dest_dir")

    docker run --rm \
        -v "${abs_archive}:/mnt/archive.tar.zst:ro" \
        -v "${abs_dest}:/mnt/dest" \
        alpine \
        sh -c 'apk add --no-cache zstd >/dev/null 2>&1 && tar --use-compress-program=zstd -xf /mnt/archive.tar.zst -C /mnt/dest'
}
