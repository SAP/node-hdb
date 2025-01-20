var mock_auth_reply= {
  kind: 2,
  functionCode: 0,
  resultSets: [],
  authentication: 'INITIAL'
};

var mock_conn_reply = {
  kind: 2,
  functionCode: 0,
  resultSets: [],
  authentication: 'FINAL',
  connectOptions: { fullVersionString: "2.00.083.00.1737144279" },
};

module.exports = {
  mock_auth_reply,
  mock_conn_reply
};
