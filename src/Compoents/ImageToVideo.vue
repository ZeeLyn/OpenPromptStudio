<template>
    <div class="wrap">
        <el-form
            :model="config"
            :rules="formRules"
            ref="form"
            label-width="auto"
            scroll-to-error
            style="width: 100%"
            :hide-required-asterisk="true"
        >
            <el-form-item label="上传图片" prop="fileList">
                <div
                    class="drag-wrap"
                    :class="dragEnter ? 'draging' : ''"
                    @dragenter.prevent="DragEnterHandle"
                    @dragover.prevent
                    @dragleave.prevent="DragLeaveHandle"
                    @dragend="DragLeaveHandle"
                    @drop.prevent="DropImageFileHandle"
                    @click="clickHandle"
                >
                    <img class="preview" :src="imageUrl" v-if="imageUrl" />
                    <template v-else> 请点击上传或拖入图片文件 </template>
                </div>
                <input type="file" ref="file" accept=".jpg,.jpeg,.png" @change="FileChangeHandle" />
            </el-form-item>
            <el-form-item label="提示词" prop="prompt">
                <el-input type="textarea" v-model="config.prompt"></el-input>
                <el-alert
                    title="消息提示的文案"
                    type="info"
                    effect="dark"
                    :closable="false"
                    style="padding: 5px 0; margin-top: 3px; line-height: 15px"
                >
                </el-alert>
            </el-form-item>
            <el-form-item label="视频时长" prop="duration">
                <el-slider
                    v-model="config.duration"
                    :min="1"
                    :max="10"
                    :format-tooltip="formatDurationTooltip"
                ></el-slider>
            </el-form-item>
            <el-form-item label="FPS" prop="fps">
                <el-slider v-model="config.fps" :min="1" :max="30" :format-tooltip="formatDurationTooltip"></el-slider>
            </el-form-item>
        </el-form>
    </div>
</template>
<script>
import axios from "axios"

export default {
    name: "image-to-video",
    data() {
        return {
            dragEnter: false,
            imageUrl: "",
            config: {
                duration: 3,
                fps: 10,
            },
            formRules: {
                source: [
                    {
                        required: true,
                        message: "请选择需要识别的图片目录",
                        trigger: "blur",
                    },
                ],
                options: [
                    {
                        required: true,
                        message: "请设置投票有多少个选项",
                        trigger: "blur",
                    },
                ],
                optionList: [
                    {
                        required: true,
                        message: "请设置投票选项",
                        trigger: "blur",
                    },
                    {
                        validator: function (rule, value, callback) {
                            if (Object.keys(this.config.optionList).length < this.config.options) {
                                callback(`请填写选项`)
                                return
                            }
                            for (var i = 0; i < this.config.options; i++) {
                                if (!this.config.optionList[`option_${i + 1}`]) {
                                    callback(`第${i + 1}个选项未填写`)
                                } else {
                                    callback()
                                }
                            }
                        }.bind(this),
                    },
                ],
                pages: [
                    {
                        required: true,
                        message: "请设置一份完整的投票有几页",
                        trigger: "blur",
                    },
                ],
                pageList: [
                    {
                        required: true,
                        message: "请设置一份完整的投票有几页",
                        trigger: "blur",
                    },
                    {
                        validator: function (rule, value, callback) {
                            if (Object.keys(this.config.pageList).length < this.config.pages) {
                                callback(`请设置每页表格投票的行和列`)
                                return
                            }
                            if (this.config.direction == 1) {
                                var listCount = 0
                                for (var i = 0; i < this.config.pages; i++) {
                                    if (!this.config.pageList[`page_${i + 1}`]) {
                                        callback(`第${i + 1}页未设置`)
                                        return
                                    }

                                    var page = this.config.pageList[`page_${i + 1}`]
                                    if (page.endCol - page.startCol + 1 != this.config.options) {
                                        callback(`第${i + 1}页的开始列和结束列跟投票选项数量不一致`)
                                        return
                                    }
                                    listCount += page.endRow - page.startRow + 1
                                }
                                if (listCount != this.config.list.length) {
                                    callback(`${this.config.pages}页的总行数跟投票名单数量不一致`)
                                    return
                                }
                                callback()
                            } else {
                                var listCount = 0
                                for (var i = 0; i < this.config.pages; i++) {
                                    if (!this.config.pageList[`page_${i + 1}`]) {
                                        callback(`第${i + 1}页未设置`)
                                        return
                                    }

                                    var page = this.config.pageList[`page_${i + 1}`]
                                    if (page.endCol - page.startCol + 1 != this.config.list.length) {
                                        callback(`第${i + 1}页的开始列和结束列跟投票名单数量不一致`)
                                        return
                                    }
                                    listCount += page.endRow - page.startRow + 1
                                }
                                if (listCount != this.config.options) {
                                    callback(`${this.config.pages}页的总行数跟投票选项数量不一致`)
                                    return
                                }
                                callback()
                            }
                        }.bind(this),
                    },
                ],
                list: [
                    {
                        required: true,
                        message: "请上传投票名单",
                        trigger: "blur",
                    },
                    {
                        validator: function (rule, value, callback) {
                            if (!this.config.list || this.config.list.length == 0) {
                                callback(`请上传投票名单`)
                            } else {
                                callback()
                            }
                        }.bind(this),
                    },
                ],
            },
        }
    },
    watch: {
        "config.prompt": function (v) {
            console.log(v)
        },
    },
    mounted() {},
    methods: {
        formatDurationTooltip(v) {
            return `${v}秒`
        },
        DropImageFileHandle(e) {
            this.dragEnter = false
            console.log(e.dataTransfer.files.length)
            const file = e.dataTransfer.files[0]
            console.log(file)
            if (!["jpg", "jpeg", "png"].includes(this.getFileExtension(file.name).toLowerCase())) {
                this.$message({ message: "只支持jpg,png格式的图片", type: "error" })
                return
            }

            this.ReadImage(file)
        },
        FileChangeHandle(e) {
            if (!["jpg", "jpeg", "png"].includes(this.getFileExtension(e.target.files[0].name).toLowerCase())) {
                this.$message({ message: "只支持jpg,png格式的图片", type: "error" })
                return
            }

            this.ReadImage(e.target.files[0])
        },
        ReadImage(file) {
            var self = this
            this.image = file
            var reader = new FileReader()
            reader.onload = function (e) {
                self.imageUrl = e.target.result
            }
            reader.readAsDataURL(file)
            let formData = new FormData()
            formData.append("file", file)
            formData.append("prompt", "abc")
            axios
                .post("http://192.168.3.55:5000/api/data", formData)
                .then((res) => {
                    console.log(res)
                    this.id = res.data.id
                    clearInterval(this.timer)
                    this.checkStatus()
                })
                .catch((err) => {
                    console.log(err)
                    this.loading = false
                    this.img = null
                })
        },
        ImportList(file) {
            var self = this
            if (![".jpg", ".jpeg", ".png"].includes(path.extname(file.path).toLowerCase())) {
                this.$message({ message: "只支持jpg,png格式的图片", type: "error" })
                return
            }
        },
        DragEnterHandle() {
            this.dragEnter = true
        },
        DragLeaveHandle() {
            this.dragEnter = false
        },
        clickHandle() {
            this.$refs["file"].click()
        },
        getFileExtension(filename) {
            console.log(filename)
            var extension = ""
            var lastIndex = filename.lastIndexOf(".")
            if (lastIndex !== -1) {
                extension = filename.slice(lastIndex + 1)
            }
            console.log(extension)
            return extension
        },
    },
}
</script>
<style scoped>
.drag-wrap {
    border: 1px #ccc dashed;
    width: 100%;
    min-height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    color: #ccc;
    cursor: pointer;
}
.draging {
    background: #0eb964;
    color: #fff;
}
input[type="file"] {
    display: none;
}
.preview {
    max-width: 400px;
    margin: 10px 10px;
}
</style>
