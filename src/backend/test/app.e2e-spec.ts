import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Messages } from '../src/constants/messages.constant';
import { PaymentMethodType } from '../src/interfaces/payment-gateway.interface';

describe('International Jewish Association Donation Platform (e2e)', () => {
  let app: INestApplication;
  const testUser = {
    email: 'test@example.com',
    password: 'Test123!',
    firstName: 'Test',
    lastName: 'User',
    preferredLanguage: 'en',
    role: 'DONOR'
  };

  const testAssociation = {
    name: 'Test Association',
    email: 'association@example.com',
    phone: '+972501234567',
    registrationNumber: '123456789',
    country: 'Israel',
    status: 'ACTIVE'
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure global validation pipe
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true
    }));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Authentication (e2e)', () => {
    let authToken: string;

    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(testUser)
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe(testUser.email);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('accessToken');
          authToken = res.body.accessToken;
        });
    });

    it('should fail login with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        })
        .expect(401)
        .expect(res => {
          expect(res.body.message).toBe(Messages.AUTH.LOGIN_FAILED.templates.en);
        });
    });
  });

  describe('Associations (e2e)', () => {
    let associationId: string;

    it('should create a new association', () => {
      return request(app.getHttpServer())
        .post('/associations')
        .send(testAssociation)
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          associationId = res.body.id;
          expect(res.body.name).toBe(testAssociation.name);
        });
    });

    it('should get association details', () => {
      return request(app.getHttpServer())
        .get(`/associations/${associationId}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(associationId);
          expect(res.body.name).toBe(testAssociation.name);
        });
    });

    it('should verify association', () => {
      return request(app.getHttpServer())
        .put(`/associations/${associationId}/verify`)
        .expect(200)
        .expect(res => {
          expect(res.body.isVerified).toBe(true);
        });
    });
  });

  describe('Campaigns (e2e)', () => {
    let campaignId: string;
    const testCampaign = {
      title: 'Test Campaign',
      description: 'Test campaign description',
      goalAmount: 10000,
      currency: 'ILS',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };

    it('should create a new campaign', () => {
      return request(app.getHttpServer())
        .post('/campaigns')
        .send(testCampaign)
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          campaignId = res.body.id;
          expect(res.body.title).toBe(testCampaign.title);
        });
    });

    it('should get campaign details', () => {
      return request(app.getHttpServer())
        .get(`/campaigns/${campaignId}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(campaignId);
          expect(res.body.title).toBe(testCampaign.title);
        });
    });

    it('should update campaign progress', () => {
      return request(app.getHttpServer())
        .post(`/campaigns/${campaignId}/progress`)
        .send({
          amount: 1000,
          currency: 'ILS'
        })
        .expect(200)
        .expect(res => {
          expect(res.body.currentAmount).toBe(1000);
        });
    });
  });

  describe('Donations (e2e)', () => {
    let donationId: string;
    const testDonation = {
      amount: 100,
      currency: 'ILS',
      paymentMethodType: PaymentMethodType.ISRAELI_CREDIT_CARD,
      isAnonymous: false
    };

    it('should create a new donation', () => {
      return request(app.getHttpServer())
        .post('/donations')
        .send(testDonation)
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          donationId = res.body.id;
          expect(res.body.amount).toBe(testDonation.amount);
        });
    });

    it('should process donation payment', () => {
      return request(app.getHttpServer())
        .post(`/donations/${donationId}/process`)
        .send({
          paymentToken: 'test_token',
          billingAddress: {
            country: 'IL',
            city: 'Tel Aviv',
            addressLine: 'Test Street 123',
            postalCode: '12345'
          }
        })
        .expect(200)
        .expect(res => {
          expect(res.body.status).toBe('COMPLETED');
        });
    });

    it('should get donation details', () => {
      return request(app.getHttpServer())
        .get(`/donations/${donationId}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(donationId);
          expect(res.body.amount).toBe(testDonation.amount);
        });
    });
  });

  describe('Documents (e2e)', () => {
    let documentId: string;
    const testDocument = {
      type: 'TAX_RECEIPT',
      metadata: {
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024
      }
    };

    it('should upload a new document', () => {
      return request(app.getHttpServer())
        .post('/documents')
        .send(testDocument)
        .expect(201)
        .expect(res => {
          expect(res.body).toHaveProperty('id');
          documentId = res.body.id;
          expect(res.body.type).toBe(testDocument.type);
        });
    });

    it('should verify document', () => {
      return request(app.getHttpServer())
        .put(`/documents/${documentId}/verify`)
        .send({
          status: 'VERIFIED',
          notes: 'Document verified successfully'
        })
        .expect(200)
        .expect(res => {
          expect(res.body.status).toBe('VERIFIED');
        });
    });

    it('should get document details', () => {
      return request(app.getHttpServer())
        .get(`/documents/${documentId}`)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(documentId);
          expect(res.body.type).toBe(testDocument.type);
        });
    });
  });

  describe('Performance Testing (e2e)', () => {
    it('should handle concurrent requests', async () => {
      const concurrentRequests = 100;
      const requests = Array(concurrentRequests).fill(null).map(() => 
        request(app.getHttpServer()).get('/campaigns')
      );
      
      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should process requests within time limit', async () => {
      const startTime = Date.now();
      await request(app.getHttpServer()).get('/campaigns');
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // 2 second limit
    });
  });

  describe('Security Testing (e2e)', () => {
    it('should require authentication for protected routes', () => {
      return request(app.getHttpServer())
        .get('/donations')
        .expect(401);
    });

    it('should validate input data', () => {
      return request(app.getHttpServer())
        .post('/donations')
        .send({
          amount: -100 // Invalid amount
        })
        .expect(400);
    });

    it('should enforce rate limiting', async () => {
      const requests = Array(150).fill(null).map(() => 
        request(app.getHttpServer()).get('/campaigns')
      );
      
      const responses = await Promise.all(requests);
      expect(responses.some(res => res.status === 429)).toBe(true);
    });
  });
});