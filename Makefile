REPORTER = list

test: 
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail \
		--recursive 

test-unit:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER)

test-acceptance:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--bail \
		test/acceptance/*.js

test-mock: 
	@HDB_MOCK=1 $(MAKE) -s test

test-cov: lib-cov
	@HDB_COV=1 $(MAKE) -s test REPORTER=html-cov > coverage.html 

lib-cov:
	@jscoverage lib lib-cov
	
clean:
	@rm -f coverage.html \
	@rm -fr lib-cov \
	@rm -f hdb.js

chromify:
	@browserify -r buffer -r ./lib:hdb -o ./hdb.js

.PHONY: test test-unit test-acceptance clean 