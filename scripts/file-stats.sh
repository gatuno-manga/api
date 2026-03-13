#!/bin/bash

# Script para analisar arquivos com foco em alto volume.
# Por padrao, roda dentro de um container no mesmo volume do backup:
#   Volume: gatuno_api-data
#   Caminho interno: /data
#
# Tambem suporta modo local quando um diretorio eh informado.

set -euo pipefail

DEFAULT_VOLUME_NAME="gatuno_api-data"
DEFAULT_CONTAINER_PATH="/data"
DEFAULT_IMAGE="bash:5.2"

TARGET_DIR=""
TOP_N=10
USE_DOCKER_MODE=true
INSIDE_MODE=false
VOLUME_NAME="$DEFAULT_VOLUME_NAME"
CONTAINER_PATH="$DEFAULT_CONTAINER_PATH"
DOCKER_IMAGE="$DEFAULT_IMAGE"
LOG_FILE=""

declare -A EXT_COUNTS
declare -A DIR_FILES
declare -A DIR_BYTES
declare -A DIR_SUBDIRS
declare -a TOP_SIZES=()
declare -a TOP_PATHS=()

TOTAL_FILES=0
TOTAL_BYTES=0
ROOT_SUBDIRS=0

show_help() {
    echo "Uso: $0 [diretorio-local] [opcoes]"
    echo ""
    echo "Sem diretorio-local, o script roda no volume Docker padrao (${DEFAULT_VOLUME_NAME})."
    echo ""
    echo "Opcoes:"
    echo "  -n N      Mostrar Top N maiores arquivos (padrao: 10)"
    echo "  -v NOME   Nome do volume Docker (padrao: ${DEFAULT_VOLUME_NAME})"
    echo "  -p CAMINHO Caminho dentro do container (padrao: ${DEFAULT_CONTAINER_PATH})"
    echo "  -i IMAGEM Imagem Docker para execucao interna (padrao: ${DEFAULT_IMAGE})"
    echo "  -l ARQUIVO Caminho do arquivo de log (padrao: logs/file-stats-AAAAMMDD-HHMMSS.log)"
    echo "  -h        Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0"
    echo "  $0 -n 20"
    echo "  $0 -v gatuno_api-data -p /data"
    echo "  $0 ./scripts -n 5"
}

setup_logging() {
    if [ -n "$LOG_FILE" ]; then
        mkdir -p "$(dirname "$LOG_FILE")"
    else
        mkdir -p "logs"
        LOG_FILE="logs/file-stats-$(date +%Y%m%d-%H%M%S).log"
    fi

    # Espelha toda a saida no terminal e no arquivo de log.
    exec > >(tee -a "$LOG_FILE") 2>&1
    echo "Log: $LOG_FILE"
    echo ""
}

human_size() {
    local bytes="$1"

    if ! [[ "$bytes" =~ ^[0-9]+$ ]]; then
        bytes=0
    fi

    if command -v numfmt >/dev/null 2>&1; then
        numfmt --to=iec --suffix=B "$bytes"
    else
        awk -v b="$bytes" 'BEGIN {
            split("B KB MB GB TB PB", u, " ")
            i = 1
            v = b + 0
            while (v >= 1024 && i < 6) {
                v = v / 1024
                i++
            }
            if (v >= 10 || i == 1) {
                printf "%.0f%s\n", v, u[i]
            } else {
                printf "%.1f%s\n", v, u[i]
            }
        }'
    fi
}

top_level_dir() {
    local rel_path="$1"
    if [[ "$rel_path" == */* ]]; then
        echo "${rel_path%%/*}"
    else
        echo "."
    fi
}

update_top_n() {
    local size="$1"
    local path="$2"
    local i
    local j
    local inserted=false
    local len=${#TOP_SIZES[@]}

    if [ "$len" -eq 0 ]; then
        TOP_SIZES=("$size")
        TOP_PATHS=("$path")
        return
    fi

    for ((i=0; i<len; i++)); do
        if [ "$size" -gt "${TOP_SIZES[$i]}" ]; then
            TOP_SIZES+=(0)
            TOP_PATHS+=("")
            for ((j=${#TOP_SIZES[@]}-1; j>i; j--)); do
                TOP_SIZES[$j]="${TOP_SIZES[$((j-1))]}"
                TOP_PATHS[$j]="${TOP_PATHS[$((j-1))]}"
            done
            TOP_SIZES[$i]="$size"
            TOP_PATHS[$i]="$path"
            inserted=true
            break
        fi
    done

    if [ "$inserted" = false ] && [ "$len" -lt "$TOP_N" ]; then
        TOP_SIZES+=("$size")
        TOP_PATHS+=("$path")
    fi

    while [ "${#TOP_SIZES[@]}" -gt "$TOP_N" ]; do
        local last_index
        last_index=$(( ${#TOP_SIZES[@]} - 1 ))
        unset "TOP_SIZES[$last_index]"
        unset "TOP_PATHS[$last_index]"
    done
}

get_extension() {
    local filename="$1"
    local base
    base="$(basename "$filename")"

    if [[ "$base" != *.* ]]; then
        echo "(sem_extensao)"
        return
    fi

    if [[ "$base" == .* && "$base" != *.*.* ]]; then
        echo "(sem_extensao)"
        return
    fi

    if [[ "$base" == .* ]]; then
        local no_dot="${base#.}"
        if [[ "$no_dot" == *.* ]]; then
            echo "${no_dot##*.}" | tr '[:upper:]' '[:lower:]'
            return
        fi
        echo "(sem_extensao)"
        return
    fi

    echo "${base##*.}" | tr '[:upper:]' '[:lower:]'
}

file_size_bytes() {
    local file="$1"

    # GNU/coreutils
    if stat -c%s "$file" >/dev/null 2>&1; then
        stat -c%s "$file"
        return
    fi

    # BSD/macOS
    if stat -f%z "$file" >/dev/null 2>&1; then
        stat -f%z "$file"
        return
    fi

    echo 0
}

run_analysis() {
    local dir="$1"

    if [ ! -d "$dir" ]; then
        echo "Erro: diretorio nao encontrado: $dir"
        exit 1
    fi

    dir="$(cd "$dir" && pwd)"

    echo "========================================"
    echo "Analise de arquivos"
    echo "Diretorio: $dir"
    echo "========================================"
    echo ""

    while IFS= read -r -d '' file_path; do
        rel_path="${file_path#"$dir"/}"
        if [ "$file_path" = "$dir" ]; then
            rel_path="$(basename "$file_path")"
        fi

        size="$(file_size_bytes "$file_path")"

        TOTAL_FILES=$((TOTAL_FILES + 1))
        TOTAL_BYTES=$((TOTAL_BYTES + size))

        ext="$(get_extension "$rel_path")"
        EXT_COUNTS["$ext"]=$(( ${EXT_COUNTS["$ext"]:-0} + 1 ))

        top_dir="$(top_level_dir "$rel_path")"
        DIR_FILES["$top_dir"]=$(( ${DIR_FILES["$top_dir"]:-0} + 1 ))
        DIR_BYTES["$top_dir"]=$(( ${DIR_BYTES["$top_dir"]:-0} + size ))

        update_top_n "$size" "$rel_path"
    done < <(find "$dir" -type f -print0)

    if [ "$TOTAL_FILES" -eq 0 ]; then
        echo "Nenhum arquivo encontrado no diretorio."
        exit 0
    fi

    while IFS= read -r -d '' abs_dir; do
        rel_dir="${abs_dir#"$dir"/}"
        [ -z "$rel_dir" ] && continue
        ROOT_SUBDIRS=$((ROOT_SUBDIRS + 1))
        if [[ "$rel_dir" == */* ]]; then
            dir_top="${rel_dir%%/*}"
            DIR_SUBDIRS["$dir_top"]=$(( ${DIR_SUBDIRS["$dir_top"]:-0} + 1 ))
        fi
    done < <(find "$dir" -mindepth 1 -type d -print0)

    local average_bytes
    average_bytes=$((TOTAL_BYTES / TOTAL_FILES))

    echo "1) RESUMO GERAL"
    echo "----------------------------------------"
    echo "Total de arquivos: $TOTAL_FILES"
    echo "Tamanho total: $(human_size "$TOTAL_BYTES")"
    echo "Tamanho medio por arquivo: $(human_size "$average_bytes")"
    echo ""

    echo "2) QUANTIDADE POR EXTENSAO"
    echo "----------------------------------------"
    {
        for ext in "${!EXT_COUNTS[@]}"; do
            echo "${EXT_COUNTS[$ext]}|$ext"
        done
    } | sort -t'|' -k1,1nr -k2,2 | while IFS='|' read -r count ext; do
        printf -- "- %-20s %8d\n" "$ext" "$count"
    done
    echo ""

    echo "3) ESTATISTICAS POR PASTA"
    echo "----------------------------------------"
    echo "Pasta | Arquivos | Subpastas | Tamanho | Media"
    echo "----- | -------- | --------- | ------- | -----"
    printf "%s | %d | %d | %s | %s\n" ". (raiz)" "$TOTAL_FILES" "$ROOT_SUBDIRS" "$(human_size "$TOTAL_BYTES")" "$(human_size "$average_bytes")"

    while IFS= read -r -d '' abs_top_dir; do
        dir_name="${abs_top_dir#"$dir"/}"
        files_in_dir=${DIR_FILES["$dir_name"]:-0}
        subdirs_in_dir=${DIR_SUBDIRS["$dir_name"]:-0}
        bytes_in_dir=${DIR_BYTES["$dir_name"]:-0}

        if [ "$files_in_dir" -gt 0 ]; then
            dir_avg=$((bytes_in_dir / files_in_dir))
        else
            dir_avg=0
        fi

        printf "%s | %d | %d | %s | %s\n" "$dir_name" "$files_in_dir" "$subdirs_in_dir" "$(human_size "$bytes_in_dir")" "$(human_size "$dir_avg")"
    done < <(find "$dir" -mindepth 1 -maxdepth 1 -type d -print0 | LC_ALL=C sort -z)
    echo ""

    echo "4) TOP ${TOP_N} MAIORES ARQUIVOS"
    echo "----------------------------------------"
    for ((i=0; i<${#TOP_SIZES[@]}; i++)); do
        printf -- "- %s | %s\n" "${TOP_PATHS[$i]}" "$(human_size "${TOP_SIZES[$i]}")"
    done
    echo ""

    echo "Analise concluida."
}

run_in_docker_volume() {
    local script_path
    script_path="$(cd "$(dirname "$0")" && pwd)/$(basename "$0")"

    if ! command -v docker >/dev/null 2>&1; then
        echo "Erro: Docker nao encontrado."
        exit 1
    fi

    if ! docker info >/dev/null 2>&1; then
        echo "Erro: Docker nao esta rodando ou sem permissao."
        exit 1
    fi

    if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
        echo "Erro: Volume Docker nao encontrado: $VOLUME_NAME"
        exit 1
    fi

    echo "Modo: Docker volume"
    echo "Volume: $VOLUME_NAME"
    echo "Caminho interno: $CONTAINER_PATH"
    echo "Imagem: $DOCKER_IMAGE"
    echo ""

    docker run --rm \
      -v "$VOLUME_NAME:$CONTAINER_PATH:ro" \
      -v "$script_path:/tmp/file-stats.sh:ro" \
      "$DOCKER_IMAGE" \
      bash /tmp/file-stats.sh --inside --target-dir "$CONTAINER_PATH" -n "$TOP_N"
}

parse_args() {
    while [ $# -gt 0 ]; do
        case "$1" in
            --inside)
                INSIDE_MODE=true
                USE_DOCKER_MODE=false
                shift
                ;;
            --target-dir)
                TARGET_DIR="$2"
                shift 2
                ;;
            -n)
                TOP_N="$2"
                shift 2
                ;;
            -v)
                VOLUME_NAME="$2"
                shift 2
                ;;
            -p)
                CONTAINER_PATH="$2"
                shift 2
                ;;
            -i)
                DOCKER_IMAGE="$2"
                shift 2
                ;;
            -l)
                LOG_FILE="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            --)
                shift
                break
                ;;
            -*)
                echo "Erro: opcao invalida: $1"
                show_help
                exit 1
                ;;
            *)
                if [ -z "$TARGET_DIR" ]; then
                    TARGET_DIR="$1"
                    USE_DOCKER_MODE=false
                else
                    echo "Erro: argumento inesperado: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done
}

main() {
    parse_args "$@"

    if [ "$INSIDE_MODE" = false ]; then
        setup_logging
    fi

    if ! [[ "$TOP_N" =~ ^[0-9]+$ ]] || [ "$TOP_N" -lt 1 ]; then
        echo "Erro: -n precisa ser um numero inteiro maior que zero"
        exit 1
    fi

    if [ "$INSIDE_MODE" = true ]; then
        TARGET_DIR="${TARGET_DIR:-$DEFAULT_CONTAINER_PATH}"
        run_analysis "$TARGET_DIR"
        exit 0
    fi

    if [ "$USE_DOCKER_MODE" = true ]; then
        run_in_docker_volume
        exit 0
    fi

    TARGET_DIR="${TARGET_DIR:-.}"
    run_analysis "$TARGET_DIR"
}

main "$@"
