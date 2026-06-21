.PHONY: run dev build

run: dev

dev:
	@echo "Starting frontend dev server..."
	@. ~/.nvm/nvm.sh && nvm use 22.19.0 && pnpm run dev

build:
	@echo "Building frontend production assets..."
	@. ~/.nvm/nvm.sh && nvm use 22.19.0 && pnpm run build
