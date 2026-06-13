@echo off
echo Building DeepGames...

echo 1. Building Rust Gateway...
cd packages\gateway
cargo build --release
cd ..\..

echo 2. Building React Frontend...
cd web
call pnpm install
call pnpm build
cd ..

echo Build complete!
pause
