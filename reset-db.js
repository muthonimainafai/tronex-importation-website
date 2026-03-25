require('dotenv').config();
const mongoose = require('mongoose');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tronex-cars';

// Connect to MongoDB
mongoose.connect(mongoUri)
    .then(() => {
        console.log('✅ Connected to MongoDB');
        resetDatabase();
    })
    .catch(err => {
        console.error('❌ Connection error:', err);
        process.exit(1);
    });

async function resetDatabase() {
    try {
        // Delete all cars
        const carResult = await mongoose.connection.collection('cars').deleteMany({});
        console.log(`🗑️  Deleted ${carResult.deletedCount} cars`);

        // Reset counter
        await mongoose.connection.collection('counters').updateOne(
            { _id: 'internalStockNumber' },
            { $set: { sequence_value: 199 } },
            { upsert: true }
        );
        console.log('✅ Counter reset so next car gets TRON{yy}-00200');

        // Verify
        const counter = await mongoose.connection.collection('counters').findOne({ _id: 'internalStockNumber' });
        console.log('📊 Counter status:', counter);

        const carCount = await mongoose.connection.collection('cars').countDocuments();
        console.log('📚 Total cars in database:', carCount);

        console.log('\n✅ Database reset complete!\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error resetting database:', error);
        process.exit(1);
    }
}