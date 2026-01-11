#!/bin/bash
# Simple release script for vkm
# Usage: ./scripts/release.sh [patch|minor|major|prerelease]

set -e

# colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # sin color

# función para mostrar mensajes
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

# comprobar que estamos en la raíz del proyecto
if [ ! -f "package.json" ]; then
    error "Este script debe ejecutarse desde la raíz del proyecto"
    exit 1
fi

# obtener el tipo de versión
VERSION_TYPE=${1:-patch}

if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major|prerelease)$ ]]; then
    error "Tipo de versión inválido: $VERSION_TYPE"
    echo "Uso: ./scripts/release.sh [patch|minor|major|prerelease]"
    exit 1
fi

info "Preparando release de tipo: $VERSION_TYPE"

# comprobar que estamos en main o una rama de release
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]] && [[ ! "$CURRENT_BRANCH" =~ ^release/ ]]; then
    warning "No estás en la rama 'main' (estás en: $CURRENT_BRANCH)"
    read -p "¿Continuar de todas formas? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Release cancelado"
        exit 1
    fi
fi

# comprobar que no hay cambios sin commitear
if [ -n "$(git status --porcelain)" ]; then
    error "Hay cambios sin commitear. Por favor, commitea o descarta los cambios primero."
    git status --short
    exit 1
fi

# obtener versión actual
CURRENT_VERSION=$(node -p "require('./package.json').version")
info "Versión actual: v$CURRENT_VERSION"

# actualizar versiones usando npm version
info "Actualizando versión en package.json..."
pnpm version "$VERSION_TYPE" --no-git-tag-version

# obtener nueva versión
NEW_VERSION=$(node -p "require('./package.json').version")
NEW_TAG="v$NEW_VERSION"

# sincronizar versiones en todos los package.json
info "Sincronizando versiones..."
cd npx-cli
pnpm version "$NEW_VERSION" --no-git-tag-version --allow-same-version
cd ..

cd frontend
pnpm version "$NEW_VERSION" --no-git-tag-version --allow-same-version
cd ..

# actualizar versiones de Cargo
info "Actualizando versiones de Cargo..."
if command -v cargo-set-version &> /dev/null; then
    cargo set-version --workspace "$NEW_VERSION"
else
    warning "cargo-set-version no instalado, saltando actualización de Cargo.toml"
    warning "Instala con: cargo install cargo-edit"
fi

success "Versión actualizada: $CURRENT_VERSION → $NEW_VERSION"

# mostrar resumen de cambios
echo ""
info "Cambios a commitear:"
git diff --stat package.json npx-cli/package.json frontend/package.json Cargo.toml Cargo.lock crates/*/Cargo.toml

echo ""
warning "¿Crear tag $NEW_TAG y pushearlo? Esto iniciará el proceso de release automático."
read -p "Continuar? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Release cancelado"
    echo ""
    info "Para revertir los cambios de versión:"
    echo "  git checkout package.json npx-cli/package.json frontend/package.json Cargo.toml Cargo.lock crates/*/Cargo.toml"
    exit 1
fi

# commitear cambios
info "Commiteando cambios de versión..."
git add package.json pnpm-lock.yaml npx-cli/package.json frontend/package.json Cargo.toml Cargo.lock
git add $(find crates -name Cargo.toml)
git commit -m "chore: bump version to $NEW_VERSION"

# crear tag
info "Creando tag $NEW_TAG..."
git tag -a "$NEW_TAG" -m "Release $NEW_TAG"

# pushear
info "Pusheando cambios y tag..."
git push
git push --tags

success "¡Release iniciado!"
echo ""
info "El tag $NEW_TAG ha sido pusheado y GitHub Actions comenzará el proceso de release."
info "Puedes seguir el progreso en: https://github.com/miermontoto/vibe-kanban/actions"
echo ""
info "Una vez completado, el release estará disponible en:"
echo "  - GitHub: https://github.com/miermontoto/vibe-kanban/releases/tag/$NEW_TAG"
if [[ ! "$NEW_VERSION" =~ (alpha|beta|rc) ]] && [[ ! "$NEW_VERSION" =~ - ]]; then
    echo "  - NPM: https://www.npmjs.com/package/@miermontoto/vkm"
else
    info "Nota: Esta es una prerelease, no se publicará en NPM automáticamente"
fi
