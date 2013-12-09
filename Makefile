REPORTER = list
DOCUMENT_ROOT = /z/node-hdb

check: test

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

test-cov: lib-cov
	@HDB_COV=1 $(MAKE) -s test REPORTER=html-cov > coverage.html 

test-cov-pub:	test-cov	
	@cp -f coverage.html $(DOCUMENT_ROOT)
	@$(MAKE) -s clean

lib-cov:
	@jscoverage lib lib-cov
	
clean:
	@rm -f coverage.html \
	rm -fr lib-cov

.PHONY: test test-unit test-acceptance clean