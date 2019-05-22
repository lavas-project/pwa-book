export PATH=$NODEJS_BIN_LATEST:$PATH

rm -rf ./docs/*
cp -rf ./_book/* ./docs

echo "build success!!!"
