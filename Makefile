test:
	@./node_modules/.bin/mocha
	
coverage:
	@./node_modules/.bin/mocha --require coverage.js --reporter html-cov > coverage.html

build: index.coffee src/*.coffee
	coffee -c $^
	
clean:
	rm -rf src/*.js index.js

.PHONY: test coverage
