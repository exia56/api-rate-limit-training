/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
const sinon = require('sinon');
const chai = require('chai');
const ApiRateLimit = require('../../tools/api-rate-limit');

chai.should();

async function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

class MockRequest {
  constructor(ip) {
    this.ip = ip;
  }
}

class MockResponse {
  send() {}

  json() {}

  setHeader() {}

  status() {
    return this;
  }
}

describe('test api rate limit', () => {
  it('should not reach limit in 2 period', async () => {
    const reachLimitSpy = sinon.spy();
    const apiRateLimit = new ApiRateLimit({ windowMs: 100, limit: 5, onReachLimit: reachLimitSpy });

    // simulate there's 5 api called
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });

    await sleep(99);

    // simulate there's 5 api called
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });

    reachLimitSpy.callCount.should.equal(0);
    await apiRateLimit.stop();
  });

  it('should reach limit 2 times', async () => {
    const reachLimitSpy = sinon.spy();
    const apiRateLimit = new ApiRateLimit({ windowMs: 100, limit: 5, onReachLimit: reachLimitSpy });

    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    const response = new MockResponse();
    const stub = sinon.stub(response, 'setHeader');
    const stubLimit = stub.withArgs('RateLimit-Limit', 5);
    const stubRemain = stub.withArgs('RateLimit-Remaining', 0);
    const stubReset = stub.withArgs('RateLimit-Reset', 1);
    const stubRetryAfter = stub.withArgs('Retry-After');
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), response, () => { });

    await apiRateLimit.stop();
    stubLimit.calledOnce.should.be.equal(true);
    stubRemain.calledOnce.should.be.equal(true);
    stubReset.calledOnce.should.be.equal(true);
    stubRetryAfter.calledOnce.should.be.equal(true);
    reachLimitSpy.callCount.should.equal(2);
  });

  it('should set rate limit header info', async () => {
    const reachLimitSpy = sinon.spy();
    const apiRateLimit = new ApiRateLimit({ windowMs: 100, limit: 5, onReachLimit: reachLimitSpy });

    // simulate there's 5 api called
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), new MockResponse(), () => { });
    const thirdResponse = new MockResponse();
    const stub = sinon.stub(thirdResponse, 'setHeader');
    const stubLimit = stub.withArgs('RateLimit-Limit', 5);
    const stubRemain = stub.withArgs('RateLimit-Remaining', 2);
    const stubReset = stub.withArgs('RateLimit-Reset', 1);
    const stubRetryAfter = stub.withArgs('Retry-After');
    await apiRateLimit.middleware(new MockRequest('127.0.0.1'), thirdResponse, () => { });

    await apiRateLimit.stop();
    stubLimit.calledOnce.should.be.equal(true);
    stubRemain.calledOnce.should.be.equal(true);
    stubReset.calledOnce.should.be.equal(true);
    stubRetryAfter.calledOnce.should.be.equal(false);
    reachLimitSpy.callCount.should.equal(0);
  });
});
