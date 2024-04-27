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
                    <img class="preview" :src="config.imageUrl" v-if="config.imageUrl" />
                    <template v-else> 请点击上传或拖入图片文件 </template>
                </div>
                <input type="file" ref="file" accept=".jpg,.jpeg,.png" @change="FileChangeHandle" />
            </el-form-item>
            <el-form-item label="提示词" prop="prompt">
                <el-input type="textarea" v-model="config.prompt"></el-input>
                <el-alert
                    v-if="config.translate_prompt"
                    :title="config.translate_prompt"
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
            <el-form-item> </el-form-item>
            <el-button
                type="primary"
                @click="submitForm"
                :loading="loading"
                style="width: 100%"
                :disabled="!config.imageUrl || !config.prompt || !config.translate_prompt || translateing"
                >生成视频</el-button
            >
        </el-form>
        <el-dialog
            title="视频预览"
            :visible.sync="dialogVisible"
            width="50%"
            :close-on-click-modal="false"
            :destroy-on-close="true"
        >
            <video
                muted
                autoplay
                :src="'https://web.inlarks.com/aigc_prompt/output/image_to_video/' + taskId + '.mp4'"
                controls
                style="width: 100%"
                loop
            ></video>
            <span slot="footer" class="dialog-footer">
                <el-link
                    type="primary"
                    icon="el-icon-download"
                    :href="'https://web.inlarks.com/aigc_prompt/output/image_to_video/' + taskId + '.mp4'"
                    :download="taskId + '.mp4'"
                    target="_blank"
                    >下载视频</el-link
                >
            </span>
        </el-dialog>
    </div>
</template>
<script>
import axios from "axios"

export default {
    name: "image-to-video",
    data() {
        return {
            dragEnter: false,
            loading: false,
            config: {
                imageUrl: "",
                prompt: "",
                duration: 2,
                fps: 8,
                translate_prompt: "",
            },
            dialogVisible: false,
            translateing: false,
            formRules: {
                imageUrl: [
                    {
                        required: true,
                        message: "请上传图片",
                        trigger: "blur",
                    },
                ],
                prompt: [
                    {
                        required: true,
                        message: "请设置提示词",
                        trigger: "blur",
                    },
                ],
            },
            taskId: "",
        }
    },
    watch: {
        "config.prompt": function (v) {
            this.last_input_time = new Date().getTime()
        },
    },
    mounted() {
        this.last_input_time = new Date().getTime()
        var self = this
        var prev_translate_prompt = ""
        this.translateTimer = setInterval(() => {
            if (new Date().getTime() - self.last_input_time > 500) {
                if (self.config.prompt == prev_translate_prompt || !self.config.prompt) return

                prev_translate_prompt = self.config.prompt
                if (!self.hasChinese(self.config.prompt)) {
                    self.config.translate_prompt = self.config.prompt
                    return
                }
                self.translateing = true
                axios
                    .post("https://app.api.inlarks.com/tencent_translate/api/translate/request", {
                        sourceText: self.config.prompt,
                    })
                    .then((res) => {
                        self.config.translate_prompt = res.data.targetText
                    })
                    .catch((err) => {
                        self.config.translate_prompt = self.config.prompt
                    })
                    .finally(() => {
                        self.translateing = false
                    })
            }
        }, 500)
    },
    methods: {
        hasChinese(str) {
            var reg = /[\u4e00-\u9fa5]/
            return reg.test(str)
        },
        submitForm() {
            this.$refs.form.validate((valid) => {
                if (valid) {
                    this.loading = true
                    let formData = new FormData()
                    formData.append("file", this.image)
                    formData.append("prompt", this.config.translate_prompt)
                    formData.append("duration", this.config.duration)
                    formData.append("fps", this.config.fps)
                    axios
                        .post("http://192.168.3.55:5000/api/data", formData)
                        .then((res) => {
                            this.taskId = res.data.id
                            this.checStatus()
                        })
                        .catch((err) => {
                            this.loading = false
                        })
                }
            })
        },
        checStatus() {
            var self = this
            this.timer = setInterval(function () {
                axios
                    .get(`http://192.168.3.55:5000/api/status/${self.taskId}`)
                    .then((res) => {
                        if (res.data.status == 1) {
                            self.video = res.data.message
                            self.loading = false
                            self.dialogVisible = true
                            clearInterval(self.timer)
                        }
                    })
                    .then()
            }, 3000)
        },
        formatDurationTooltip(v) {
            return `${v}秒`
        },
        DropImageFileHandle(e) {
            this.dragEnter = false
            const file = e.dataTransfer.files[0]
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
                self.config.imageUrl = e.target.result
            }
            reader.readAsDataURL(file)
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
    beforeDestroy() {
        clearInterval(this.translateTimer)
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
.drag-wrap:hover {
    border: 1px #666 solid;
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
