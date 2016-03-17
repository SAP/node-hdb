REPORTER = spec

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		-R $(REPORTER) -b	--recursive

test-unit:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		-R $(REPORTER) -b

test-acceptance:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		-R $(REPORTER) -b	test/acceptance/*.js

test-mock:
	@HDB_MOCK=1 $(MAKE) -s test

test-lcov:
	@NODE_ENV=test ./node_modules/.bin/istanbul cover \
		--report lcov \
			./node_modules/mocha/bin/_mocha -- \
			-R spec -b --recursive

test-coveralls:
	@NODE_ENV=test ./node_modules/.bin/istanbul cover \
	  --report lcovonly \
		./node_modules/mocha/bin/_mocha -- \
			-R spec -b --recursive \
			&& cat ./coverage/lcov.info | node ./bin/coveralls.js \
			&& rm -rf ./coverage

clean:
	@rm -rf ./coverage \
	@rm -f hdb.js

chromify:
	@browserify -r buffer -r ./lib:hdb -o ./hdb.js

.PHONY: test clean