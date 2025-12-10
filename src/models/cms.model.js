const mongoose = require('mongoose')
const slugify = require('slugify')
const { toJSON, paginate } = require('./plugins');

const cmsSchema = new mongoose.Schema({
    pageTitle: {
        type: String,
        required: [true, 'Please add a title'],
        maxlength: [150, 'Title can not be more than 150 characters']
    },
    banner: {
        type: String,
        default: ''
    },
    pageContent: {
        type: String,
        required: [true, 'Please add content']
    },
    link:{
        type: String,
        default: null
    },
    slug: {
        type: String,
        default: null
    },
    contentType: {
        type: Number,
        default: 1 // 1 for cms, 2 = help
    },
    sequence:{
        type:Number,
        default:null
    },
    metaTitle: {
        type: String,
        default: ''
    },
    metaDescription: {
        type: String,
        default: ''
    },
    metaKeywords: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
})

cmsSchema.pre('save', function (next) {
    this.slug = slugify(this.pageTitle, { lower: true })
    next()
})

cmsSchema.pre('save', async function (next) {
    const page = this
    if (page.isModified('pageTitle')) {
        page.slug = slugify(this.pageTitle, { lower: true })
    }
    next()
})

cmsSchema.plugin(toJSON);
cmsSchema.plugin(paginate);

const Cms = new mongoose.model('Cms', cmsSchema)
module.exports = Cms