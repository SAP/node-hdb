MOCHA          = ./node_modules/.bin/mocha
MOCHA_REPORTER = spec

C8             = ./node_modules/.bin/c8
C8_REPORTERS   = --reporter=text --reporter=html --reporter=lcov

test:
	@NODE_ENV=test $(MOCHA) \
		-R $(MOCHA_REPORTER) -b	--recursive

test-unit:
	@NODE_ENV=test $(MOCHA) \
		-R $(MOCHA_REPORTER) -b

test-acceptance:
	@NODE_ENV=test $(MOCHA) \
		-R $(MOCHA_REPORTER) -b	test/acceptance/*.js

test-coverage:
	@NODE_ENV=test $(C8) $(C8_REPORTERS) $(MOCHA) \
		-R $(MOCHA_REPORTER) -b	--recursive

test-unit-coverage:
	@NODE_ENV=test $(C8) $(C8_REPORTERS) $(MOCHA) \
		-R $(MOCHA_REPORTER) -b

test-acceptance-coverage:
	@NODE_ENV=test $(C8) $(C8_REPORTERS) $(MOCHA) \
		-R $(MOCHA_REPORTER) -b	test/acceptance/*.js

test-mock:
	@HDB_MOCK=1 $(MAKE) -s test

clean:
	@rm -rf ./coverage \
	@rm -f hdb.js

chromify:
	@browserify -r buffer -r ./lib:hdb -o ./hdb.js

.PHONY: test test-unit test-acceptance test-coverage test-unit-coverage test-acceptance-coverage clean
